"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { contactName, type NamedContact } from "@/lib/format";
import { personName } from "@/lib/import/appfolio";
import { MAX_OWNERS } from "@/lib/property-form";
import { allowsRepairDeductible, defaultLeaseSettings, leaseSettingsSchema } from "@/lib/property-lease-settings";
import { requireCompany } from "@/lib/session";

export type FormState = { error?: string; message?: string; values?: Record<string, string> };

const EDIT_ROLES = ["admin", "property_manager"];
const NOT_ALLOWED = "Only an admin or property manager can change properties.";

// Optional text. A field the form hides (e.g. last name for a business) arrives as undefined.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

function typed(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
}

export async function updateProperty(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };

  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(2, "Enter the property name.").max(120),
      property_type: z.enum(["single_family", "multi_family", "commercial", "mixed_use"]),
      address_line1: text(150),
      address_line2: text(150),
      city: text(80),
      state: text(2),
      postal_code: text(10),
      county: text(60),
      year_built: z
        .string()
        .trim()
        .transform((v) => (v ? Number(v) : null))
        .refine((v) => v == null || (Number.isInteger(v) && v >= 1800 && v <= 2100), "Enter a 4-digit year built."),
      entity_id: z.string(),
      new_entity_name: text(150),
      notes: text(4000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const { id, new_entity_name, entity_id, ...fields } = parsed.data;

  // Ownership splits: rows of name + percent; blank rows are ignored.
  const owners: { name: string; pct: number }[] = [];
  for (let i = 0; i < MAX_OWNERS; i++) {
    const name = String(form.get(`owner_name_${i}`) ?? "").trim();
    const pctRaw = String(form.get(`owner_pct_${i}`) ?? "").trim();
    if (!name && !pctRaw) continue;
    const pct = Number(pctRaw);
    if (!name) return { error: `Enter a name for owner ${i + 1}.`, values: typed(form) };
    if (!(pct > 0 && pct <= 100)) return { error: `Enter ${name}'s ownership as a percent between 0 and 100.`, values: typed(form) };
    owners.push({ name, pct });
  }
  const total = owners.reduce((s, o) => s + o.pct, 0);
  if (owners.length && Math.abs(total - 100) > 0.001) {
    return { error: `Ownership adds up to ${Number(total.toFixed(3))}%. It must total 100%.`, values: typed(form) };
  }
  if (new Set(owners.map((o) => o.name.toLowerCase())).size !== owners.length) return { error: "Each owner can only be listed once.", values: typed(form) };

  let entityId = entity_id;
  if (entity_id === "new") {
    if (!new_entity_name) return { error: "Enter the new LLC's name.", values: typed(form) };
    const { data, error } = await supabase.from("entity").insert({ company_id: company.id, name: new_entity_name, entity_type: "LLC" }).select("id").single();
    if (error) return { error: error.message, values: typed(form) };
    entityId = data.id;
  }

  const { error } = await supabase
    .from("property")
    .update({ ...fields, entity_id: entityId, kind: fields.property_type === "commercial" ? "commercial" : fields.property_type === "mixed_use" ? "mixed" : "residential" })
    .eq("id", id)
    .eq("company_id", company.id);
  if (error) return { error: error.message, values: typed(form) };

  // Replace the ownership rows. Owners are contacts; reuse one with the same name.
  const { data: contacts } = await supabase.from("contact").select("id, kind, first_name, last_name, business_name").eq("company_id", company.id);
  const byName = new Map((contacts ?? []).map((c) => [contactName(c as NamedContact).toLowerCase(), c.id]));
  const rows = [];
  for (const o of owners) {
    let contactId = byName.get(o.name.toLowerCase());
    if (!contactId) {
      const business = /\b(llc|inc|corp|trust|lp|ltd|company)\b/i.test(o.name);
      const { data, error: cErr } = await supabase
        .from("contact")
        .insert({ company_id: company.id, ...(business ? { kind: "business", business_name: o.name } : { kind: "person", ...personName(o.name) }) })
        .select("id")
        .single();
      if (cErr) return { error: cErr.message, values: typed(form) };
      contactId = data.id;
    }
    rows.push({ company_id: company.id, property_id: id, owner_contact_id: contactId, ownership_pct: o.pct });
  }
  const del = await supabase.from("property_owner").delete().eq("property_id", id).eq("company_id", company.id);
  if (del.error) return { error: del.error.message, values: typed(form) };
  if (rows.length) {
    const ins = await supabase.from("property_owner").insert(rows);
    if (ins.error) return { error: ins.error.message, values: typed(form) };
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  return { message: "Saved." };
}

const PROPERTY_TYPES = ["single_family", "multi_family", "commercial", "mixed_use"] as const;
const kindFor = (t: (typeof PROPERTY_TYPES)[number]) => (t === "commercial" ? "commercial" : t === "mixed_use" ? "mixed" : "residential");

/** New property: details and owning LLC. Units are added on the property page next. */
export async function createProperty(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter the property name.").max(120),
      property_type: z.enum(PROPERTY_TYPES),
      address_line1: z.string().trim().min(3, "Enter the street address.").max(150),
      address_line2: text(150),
      city: z.string().trim().min(2, "Enter the city.").max(80),
      state: z.string().trim().length(2, "Use the 2-letter state, like FL.").transform((v) => v.toUpperCase()),
      postal_code: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP."),
      county: text(60),
      year_built: z
        .string()
        .trim()
        .transform((v) => (v ? Number(v) : null))
        .refine((v) => v == null || (Number.isInteger(v) && v >= 1800 && v <= 2100), "Enter a 4-digit year built."),
      entity_id: z.string(),
      new_entity_name: text(150),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const { entity_id, new_entity_name, ...fields } = parsed.data;

  let entityId = entity_id;
  if (entity_id === "new" || !entity_id) {
    if (!new_entity_name) return { error: "Choose the owning LLC or enter a new one.", values: typed(form) };
    const { data, error } = await supabase.from("entity").insert({ company_id: company.id, name: new_entity_name, entity_type: "LLC" }).select("id").single();
    if (error) return { error: error.message, values: typed(form) };
    entityId = data.id;
  }
  const { data: property, error } = await supabase
    .from("property")
    .insert({ ...fields, company_id: company.id, entity_id: entityId, kind: kindFor(fields.property_type) })
    .select("id")
    .single();
  if (error) return { error: error.message, values: typed(form) };

  // A single-family home has exactly one unit; create it so it's ready for a lease.
  if (fields.property_type === "single_family") {
    await supabase.from("unit").insert({ company_id: company.id, property_id: property.id, label: "Home", kind: "residential", status: "vacant" });
  }
  revalidatePath("/properties");
  redirect(`/properties/${property.id}?added=1`);
}

const unitSchema = z.object({
  property_id: z.string().uuid(),
  id: z.string(),
  label: z.string().trim().min(1, "Enter the unit number or name.").max(60),
  kind: z.enum(["residential", "commercial"]),
  beds: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v == null || (v >= 0 && v <= 20), "Enter bedrooms as a number."),
  baths: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v == null || (v >= 0 && v <= 20 && (v * 2) % 1 === 0), "Enter bathrooms like 1, 1.5 or 2."),
  sqft: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v.replace(/,/g, "")) : null))
    .refine((v) => v == null || (Number.isInteger(v) && v > 0 && v < 1_000_000), "Enter square feet as a whole number."),
  market_rent: z
    .string()
    .trim()
    .transform((v) => v.replace(/[$,\s]/g, ""))
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), "Enter market rent as a dollar amount.")
    .transform((v) => (v ? Math.round(Number(v) * 100) : null)),
  status: z.enum(["vacant", "listed", "down", "occupied", "notice"]),
  amenities: z.string().trim().max(500),
  notes: text(2000),
});

/** Add a unit to a property, or edit one (`id` set). */
export async function saveUnit(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = unitSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const { property_id, id, market_rent, amenities, ...fields } = parsed.data;
  const row = {
    ...fields,
    market_rent_cents: market_rent,
    amenities: amenities ? amenities.split(",").map((a) => a.trim()).filter(Boolean) : [],
    beds: fields.kind === "commercial" ? null : fields.beds,
    baths: fields.kind === "commercial" ? null : fields.baths,
  };
  const { error } = id
    ? await supabase.from("unit").update(row).eq("id", id).eq("company_id", company.id)
    : await supabase.from("unit").insert({ ...row, company_id: company.id, property_id });
  if (error) return { error: error.code === "23505" ? `This property already has a unit called ${fields.label}.` : error.message, values: typed(form) };
  revalidatePath(`/properties/${property_id}`);
  revalidatePath("/properties");
  return { message: id ? "Saved." : `Unit ${fields.label} added.` };
}

/** The property's lease settings: who handles what, utilities, keys, deposit account, disclosure answers. */
export async function saveLeaseSettings(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("property_id"));
  if (!id.success) return { error: "Property not found." };
  const { data: property } = await supabase.from("property").select("id, property_type, unit(id)").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!property) return { error: "Property not found." };
  const raw = Object.fromEntries(form);
  // Unanswered radio groups aren't submitted; start from the defaults so they stay blank or default.
  const parsed = leaseSettingsSchema.safeParse({ ...defaultLeaseSettings(property.property_type, property.unit.length), ...raw, irrigation: raw.irrigation === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const s = parsed.data;
  if (s.repairDeductible === "resident" && !allowsRepairDeductible(property.property_type, property.unit.length)) {
    return { error: "Florida only lets a lease shift repair duties to the tenant in a single-family home or duplex (83.51(1)), so this building can't have the repair deductible.", values: typed(form) };
  }
  if (s.leadKnown === "known" && !s.leadKnownDescription) return { error: "Describe the known lead-based paint.", values: typed(form) };
  if (s.leadRecords === "provided" && !s.leadRecordsList) return { error: "List the lead paint records you provide.", values: typed(form) };
  const { error } = await supabase.from("property").update({ lease_settings: s }).eq("id", property.id).eq("company_id", company.id);
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath(`/properties/${property.id}`);
  return { message: "Lease settings saved. Every lease at this property uses them." };
}
