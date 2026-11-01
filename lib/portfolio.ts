import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { contactName, oneLineAddress, PROPERTY_TYPE_LABEL } from "@/lib/format";

// Queries shared by the property list, its CSV export and the dashboard.

type Db = SupabaseClient<Database>;

export type PropertyFilters = { q: string; type: string; entity: string };

export async function listProperties(supabase: Db, companyId: string, f: PropertyFilters) {
  const { data, error } = await supabase
    .from("property")
    .select(
      "id, name, kind, property_type, address_line1, address_line2, city, state, postal_code, entity(id, name), unit(id, status, lease(rent_cents, status)), property_owner(ownership_pct, contact(first_name, last_name, business_name))",
    )
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;

  const q = f.q.toLowerCase();
  return (data ?? [])
    .map((p) => {
      const units = p.unit ?? [];
      const occupied = units.filter((u) => u.status === "occupied" || u.status === "notice").length;
      const rent = units.reduce((s, u) => s + (u.lease ?? []).filter((l) => l.status === "active" || l.status === "notice").reduce((a, l) => a + l.rent_cents, 0), 0);
      return {
        id: p.id,
        name: p.name,
        type: PROPERTY_TYPE_LABEL[p.property_type ?? ""] ?? (p.kind === "commercial" ? "Commercial" : "Residential"),
        propertyType: p.property_type,
        address: oneLineAddress(p),
        entityId: p.entity?.id ?? null,
        entityName: p.entity?.name ?? "",
        owners: p.property_owner.map((o) => `${contactName(o.contact)} ${Number(o.ownership_pct)}%`).join(" · "),
        units: units.length,
        occupied,
        rentCents: rent,
      };
    })
    .filter((p) => (!f.type || p.propertyType === f.type) && (!f.entity || p.entityId === f.entity))
    .filter((p) => !q || `${p.name} ${p.address} ${p.entityName} ${p.owners}`.toLowerCase().includes(q));
}
