import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { contactName, contactSortKey, oneLineAddress } from "@/lib/format";
import { vendorCompliance } from "@/lib/vendors";

// The vendor directory, shared by the screen and its CSV export.

type Db = SupabaseClient<Database>;

export type VendorFilters = { q: string; trade: string; paperwork: string };

export const PAPERWORK_OPTIONS: [string, string][] = [
  ["blocked", "Can't be dispatched"],
  ["expiring", "Insurance ending soon"],
  ["ok", "Paperwork complete"],
  ["not_required", "Doesn't come on site"],
];

export async function listVendors(supabase: Db, companyId: string, f: VendorFilters, today: string) {
  const { data, error } = await supabase
    .from("vendor")
    .select("*, contact(id, kind, first_name, last_name, business_name, email, mobile, phone, address_line1, address_line2, city, state, postal_code, notes)")
    .eq("company_id", companyId)
    .eq("is_active", true);
  if (error) throw error;

  const q = f.q.toLowerCase();
  return (data ?? [])
    .map((v) => ({
      ...v,
      name: contactName(v.contact),
      sortKey: contactSortKey(v.contact),
      phoneDisplay: v.contact.phone ?? v.contact.mobile,
      address: oneLineAddress(v.contact),
      compliance: vendorCompliance(v, today),
    }))
    .filter((v) => !f.trade || v.trade === f.trade)
    .filter((v) => !f.paperwork || v.compliance.status === f.paperwork)
    .filter((v) => !q || `${v.name} ${v.trade ?? ""} ${v.contact.email ?? ""} ${v.phoneDisplay ?? ""} ${v.contact.notes ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
