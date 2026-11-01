import type { NextRequest } from "next/server";
import { csvMoney, csvResponse } from "@/lib/csv";
import { csvDate, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { listTenants } from "@/lib/tenants";

export async function GET(request: NextRequest) {
  const { supabase, company } = await requireCompany();
  const p = request.nextUrl.searchParams;
  const rows = await listTenants(supabase, company.id, { q: p.get("q") ?? "", property: p.get("property") ?? "", show: p.get("show") ?? "" }, todayIn(company.time_zone));
  return csvResponse(
    "tenants.csv",
    ["Tenant", "Other tenants", "Property", "Unit", "Unit type", "Phone", "Email", "Rent", "Deposit held", "Deposit pending", "Lease start", "Lease end", "Move-out", "Lease status", "Owes"],
    rows.map((r) => [
      r.name, r.others.join("; "), r.propertyName, r.unitLabel, r.unitKind, r.phone, r.email,
      csvMoney(r.rentCents), csvMoney(r.depositCents), csvMoney(r.depositPendingCents),
      csvDate(r.startDate), r.endDate ? csvDate(r.endDate) : "Month-to-month", csvDate(r.moveOutOn), r.timing.label, csvMoney(r.balanceCents),
    ]),
  );
}
