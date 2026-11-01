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

/** The next date after a recurring bill is created. */
export function nextBillDate(current: string, frequency: string): string {
  const [y, m, d] = current.split("-").map(Number);
  const months = frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : 1;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.toISOString().slice(0, 7)}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** Create the bills that are due (daily job and "create now"). Each still needs approval. */
export async function runRecurringBills(supabase: Db, companyId: string, today: string): Promise<number> {
  const { data: due } = await supabase.from("recurring_bill").select("id, vendor_id, property_id, amount_cents, expense_account, memo, frequency, next_on, property(entity_id)").eq("company_id", companyId).eq("active", true).lte("next_on", today);
  let n = 0;
  for (const r of due ?? []) {
    let next = r.next_on;
    // Catch up if the job didn't run, one bill per period.
    while (next <= today) {
      const { error } = await supabase.from("bill").insert({ company_id: companyId, entity_id: r.property.entity_id, vendor_id: r.vendor_id, property_id: r.property_id, amount_cents: r.amount_cents, expense_account: r.expense_account, memo: r.memo, invoice_date: next, due_date: next, source: "recurring" });
      if (error) break;
      n++;
      next = nextBillDate(next, r.frequency);
    }
    await supabase.from("recurring_bill").update({ next_on: next }).eq("id", r.id);
  }
  return n;
}
