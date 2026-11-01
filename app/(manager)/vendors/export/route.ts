import type { NextRequest } from "next/server";
import { csvResponse } from "@/lib/csv";
import { csvDate, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { listVendors } from "@/lib/vendor-list";
import { PAYMENT_METHOD_LABEL } from "@/lib/vendors";

export async function GET(request: NextRequest) {
  const { supabase, company } = await requireCompany();
  const p = request.nextUrl.searchParams;
  const rows = await listVendors(supabase, company.id, { q: p.get("q") ?? "", trade: p.get("trade") ?? "", paperwork: p.get("paperwork") ?? "" }, todayIn(company.time_zone));
  return csvResponse(
    "vendors.csv",
    ["Vendor", "Trade", "Phone", "Mobile", "Email", "Address", "Pay by", "1099", "W-9 on file", "Insurance expires", "Workers' comp expires", "Paperwork", "Last paid"],
    rows.map((v) => [
      v.name, v.trade, v.contact.phone, v.contact.mobile, v.contact.email, v.address,
      v.payment_method ? PAYMENT_METHOD_LABEL[v.payment_method] : "", v.is_1099 ? "Yes" : "No", v.w9_on_file ? "Yes" : "No",
      csvDate(v.coi_expires_on), csvDate(v.workers_comp_expires_on), v.compliance.issues.join("; ") || (v.compliance.status === "not_required" ? "Not needed" : "Complete"),
      csvDate(v.last_paid_on),
    ]),
  );
}
