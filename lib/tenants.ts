import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { contactName, contactSortKey } from "@/lib/format";
import { leaseTiming } from "@/lib/leases";

// The tenant list: one row per current lease (active or on notice), shared by the screen and its CSV export.

type Db = SupabaseClient<Database>;

export type TenantFilters = { q: string; property: string; show: string };

export const TENANT_SHOW_OPTIONS: [string, string][] = [
  ["draft", "Drafts (not signed yet)"],
  ["owes", "Owes money"],
  ["ending", "Lease ends within 90 days"],
  ["mtm", "Month-to-month"],
  ["notice", "On notice"],
  ["no-contact", "Missing phone and email"],
  ["commercial", "Commercial"],
  ["residential", "Residential"],
];

export async function listTenants(supabase: Db, companyId: string, f: TenantFilters, today: string) {
  const { data, error } = await supabase
    .from("lease")
    .select(
      "id, status, start_date, end_date, move_out_on, rent_cents, deposit_cents, deposit_pending_cents, opening_balance_cents, unit!inner(id, label, kind, property!inner(id, name)), lease_tenant(is_primary, role, contact(id, kind, first_name, last_name, business_name, email, mobile, phone))",
    )
    .eq("company_id", companyId)
    .in("status", ["active", "notice", "draft"]);
  if (error) throw error;

  const q = f.q.toLowerCase();
  return (data ?? [])
    .map((l) => {
      const people = [...l.lease_tenant].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map((t) => t.contact);
      const primary = people[0];
      return {
        leaseId: l.id,
        primary,
        name: contactName(primary),
        others: people.slice(1).map(contactName),
        sortKey: primary ? contactSortKey(primary) : "",
        email: primary?.email ?? null,
        phone: primary?.mobile ?? primary?.phone ?? null,
        propertyId: l.unit.property.id,
        propertyName: l.unit.property.name,
        unitLabel: l.unit.label,
        unitKind: l.unit.kind,
        rentCents: l.rent_cents,
        depositCents: l.deposit_cents,
        depositPendingCents: l.deposit_pending_cents,
        balanceCents: l.opening_balance_cents,
        startDate: l.start_date,
        endDate: l.end_date,
        moveOutOn: l.move_out_on,
        status: l.status,
        timing: leaseTiming(l, today),
      };
    })
    .filter((r) => !f.property || r.propertyId === f.property)
    .filter((r) => {
      switch (f.show) {
        case "draft": return r.status === "draft";
        case "owes": return (r.balanceCents ?? 0) > 0;
        case "ending": return r.timing.daysLeft != null && r.timing.daysLeft <= 90;
        case "mtm": return !r.endDate && r.status === "active";
        case "notice": return r.status === "notice";
        case "no-contact": return !r.email && !r.phone;
        case "commercial": return r.unitKind === "commercial";
        case "residential": return r.unitKind === "residential";
        default: return true;
      }
    })
    .filter((r) => !q || `${r.name} ${r.others.join(" ")} ${r.propertyName} ${r.unitLabel} ${r.email ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
