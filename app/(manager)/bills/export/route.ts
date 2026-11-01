import type { NextRequest } from "next/server";
import { csvMoney, csvResponse } from "@/lib/csv";
import { BILL_STATUS, listBills } from "@/lib/bills";
import { csvDate } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { supabase, company } = await requireCompany();
  const p = request.nextUrl.searchParams;
  const rows = await listBills(supabase, company.id, { status: p.get("status") || "open", property: p.get("property") ?? "", q: p.get("q") ?? "" });
  return csvResponse(
    "bills.csv",
    ["Vendor", "Invoice", "Property", "Invoice date", "Due", "Status", "Amount", "Paid on", "Memo"],
    rows.map((b) => [b.vendorName, b.invoice_number, b.property?.name, csvDate(b.invoice_date), csvDate(b.due_date), BILL_STATUS[b.status]?.label ?? b.status, csvMoney(b.amount_cents), csvDate(b.paid_on), b.memo]),
  );
}
