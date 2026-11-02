import "server-only";
import { z } from "zod";
import { contactName, todayIn } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTenants } from "@/lib/tenants";

// What the public API and MCP server return. Always filtered to the caller's company (the service client
// skips Row Level Security, so every query here names company_id). Never returned: door codes and access
// notes, tax IDs, bank details, Social Security numbers, or anything about other companies.

export const RESOURCES = ["properties", "units", "leases", "owners", "vendors", "work-orders"] as const;
export type Resource = (typeof RESOURCES)[number];
export type Page = { limit: number; offset: number; property?: string };

export const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  property_id: z.string().uuid().optional(),
});

export async function listResource(companyId: string, resource: Resource, p: Page): Promise<Record<string, unknown>[]> {
  const db = createAdminClient();
  const range = [p.offset, p.offset + p.limit - 1] as const;
  switch (resource) {
    case "properties": {
      let q = db.from("property").select("id, name, property_type, address_line1, address_line2, city, state, postal_code, entity(id, name), unit(id)").eq("company_id", companyId).order("name").range(...range);
      if (p.property) q = q.eq("id", p.property);
      const { data } = await q;
      return (data ?? []).map((x) => ({ id: x.id, name: x.name, type: x.property_type, address: { line1: x.address_line1, line2: x.address_line2, city: x.city, state: x.state, postal_code: x.postal_code }, owner: x.entity ? { id: x.entity.id, name: x.entity.name } : null, unit_count: x.unit.length }));
    }
    case "units": {
      let q = db.from("unit").select("id, property_id, label, kind, beds, baths, sqft, status, market_rent_cents").eq("company_id", companyId).order("property_id").order("label").range(...range);
      if (p.property) q = q.eq("property_id", p.property);
      const { data } = await q;
      return data ?? [];
    }
    case "leases": {
      const { data: company } = await db.from("company").select("time_zone").eq("id", companyId).single();
      const rows = await listTenants(db, companyId, { q: "", property: p.property ?? "", show: "" }, todayIn(company?.time_zone ?? "America/New_York"));
      return rows.slice(p.offset, p.offset + p.limit).map((r) => ({
        id: r.leaseId,
        status: r.status,
        property_id: r.propertyId,
        property: r.propertyName,
        unit: r.unitLabel,
        unit_kind: r.unitKind,
        tenant: r.name,
        other_tenants: r.others,
        email: r.email,
        phone: r.phone,
        rent_cents: r.rentCents,
        deposit_cents: r.depositCents,
        balance_cents: r.balanceCents,
        start_date: r.startDate,
        end_date: r.endDate,
        move_out_on: r.moveOutOn,
      }));
    }
    case "owners": {
      const { data } = await db.from("entity").select("id, name, entity_type, email, phone, mailing_address, property(id, name)").eq("company_id", companyId).order("name").range(...range);
      return (data ?? []).map((o) => ({ id: o.id, name: o.name, type: o.entity_type, email: o.email, phone: o.phone, mailing_address: o.mailing_address, properties: o.property.map((x) => ({ id: x.id, name: x.name })) }));
    }
    case "vendors": {
      const { data } = await db.from("vendor").select("id, trade, is_active, is_1099, w9_on_file, coi_expires_on, workers_comp_expires_on, license_expires_on, contact(kind, first_name, last_name, business_name, email, phone, mobile)").eq("company_id", companyId).range(...range);
      return (data ?? []).map((v) => ({ id: v.id, name: contactName(v.contact), trade: v.trade, active: v.is_active, w9_on_file: v.w9_on_file, is_1099: v.is_1099, insurance_expires_on: v.coi_expires_on, workers_comp_expires_on: v.workers_comp_expires_on, license_expires_on: v.license_expires_on, email: v.contact?.email ?? null, phone: v.contact?.mobile ?? v.contact?.phone ?? null }));
    }
    case "work-orders": {
      let q = db
        .from("work_order")
        .select("id, number, title, priority, status, source, property_id, unit_id, created_at, scheduled_start, scheduled_end, completed_at, cost_cents, property(name), unit(label), vendor(id, contact(kind, first_name, last_name, business_name))")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(...range);
      if (p.property) q = q.eq("property_id", p.property);
      const { data } = await q;
      return (data ?? []).map((w) => ({ id: w.id, number: w.number, title: w.title, priority: w.priority, status: w.status, source: w.source, property_id: w.property_id, property: w.property?.name ?? null, unit_id: w.unit_id, unit: w.unit?.label ?? null, vendor: w.vendor ? { id: w.vendor.id, name: contactName(w.vendor.contact) } : null, created_at: w.created_at, scheduled_start: w.scheduled_start, scheduled_end: w.scheduled_end, completed_at: w.completed_at, cost_cents: w.cost_cents }));
    }
  }
}

export const newWorkOrderSchema = z.object({
  property_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(200),
  details: z.string().trim().max(4000).optional(),
  priority: z.enum(["routine", "urgent", "emergency"]).default("routine"),
});

/** A new work order from an integration: status new, for the office to assign (source "api"). */
export async function createApiWorkOrder(companyId: string, input: z.infer<typeof newWorkOrderSchema>): Promise<{ id: string; number: number } | { error: string }> {
  const db = createAdminClient();
  const { data: prop } = await db.from("property").select("id").eq("id", input.property_id).eq("company_id", companyId).maybeSingle();
  if (!prop) return { error: "property_id isn't one of your properties." };
  if (input.unit_id) {
    const { data: unit } = await db.from("unit").select("id").eq("id", input.unit_id).eq("property_id", prop.id).maybeSingle();
    if (!unit) return { error: "unit_id isn't in that property." };
  }
  const { data: wo, error } = await db
    .from("work_order")
    .insert({ company_id: companyId, property_id: prop.id, unit_id: input.unit_id ?? null, source: "api", title: input.title, tenant_note: input.details ?? null, priority: input.priority, status: "new" })
    .select("id, number")
    .single();
  if (error || !wo) return { error: error?.message ?? "The work order couldn't be created." };
  await db.from("work_order_event").insert({ company_id: companyId, work_order_id: wo.id, kind: "created", detail: { by: "api" } });
  return wo;
}
