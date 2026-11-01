import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { contactName } from "@/lib/format";

// Bills list shared by the screen and its CSV export.
type Db = SupabaseClient<Database>;

export const BILL_STATUS: Record<string, { label: string; tone: "success" | "warn" | "danger" | "info" | "neutral" }> = {
  received: { label: "Needs approval", tone: "warn" },
  approved: { label: "Approved, unpaid", tone: "info" },
  scheduled: { label: "Payment scheduled", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  void: { label: "Void", tone: "neutral" },
};

export const EXPENSE_ACCOUNTS: [string, string][] = [
  ["5000", "Repairs and maintenance"],
  ["5200", "Utilities"],
  ["5300", "Insurance"],
  ["5400", "Property taxes"],
  ["5500", "Mortgage interest"],
  ["5100", "Management fees"],
  ["5110", "Leasing and renewal fees"],
  ["5900", "Other expenses"],
];

export type BillFilters = { status: string; property: string; q: string };

export async function listBills(supabase: Db, companyId: string, f: BillFilters) {
  let query = supabase
    .from("bill")
    .select("id, status, amount_cents, invoice_number, invoice_date, due_date, paid_on, memo, source, property(id, name), vendor(id, contact(kind, first_name, last_name, business_name)), work_order(number)")
    .eq("company_id", companyId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);
  if (f.status === "open") query = query.in("status", ["received", "approved", "scheduled"]);
  else if (f.status) query = query.eq("status", f.status);
  if (f.property) query = query.eq("property_id", f.property);
  const { data, error } = await query;
  if (error) throw error;
  const q = f.q.toLowerCase();
  return (data ?? [])
    .map((b) => ({ ...b, vendorName: b.vendor ? contactName(b.vendor.contact) : "No vendor" }))
    .filter((b) => !q || `${b.vendorName} ${b.invoice_number ?? ""} ${b.memo ?? ""} ${b.property?.name ?? ""}`.toLowerCase().includes(q));
}
