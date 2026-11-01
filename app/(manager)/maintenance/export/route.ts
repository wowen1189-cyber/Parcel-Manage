import type { NextRequest } from "next/server";
import { csvMoney, csvResponse } from "@/lib/csv";
import { csvDate } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { listWorkOrders } from "@/lib/work-order-list";
import { formatWhen, WO_PRIORITY, WO_STATUS } from "@/lib/work-orders";

export async function GET(request: NextRequest) {
  const { supabase, company } = await requireCompany();
  const p = request.nextUrl.searchParams;
  const rows = await listWorkOrders(supabase, company.id, { q: p.get("q") ?? "", view: p.get("view") || "open", priority: p.get("priority") ?? "", property: p.get("property") ?? "" });
  return csvResponse(
    "work-orders.csv",
    ["Number", "Issue", "Where", "Priority", "Status", "Vendor", "Opened", "Scheduled", "Completed", "Cost"],
    rows.map((w) => [
      w.number, w.title, w.where, WO_PRIORITY[w.priority]?.label ?? w.priority, WO_STATUS[w.status]?.label ?? w.status, w.vendorName,
      csvDate(w.created_at), w.scheduled_start ? formatWhen(w.scheduled_start, company.time_zone) : "", csvDate(w.completed_at), csvMoney(w.cost_cents),
    ]),
  );
}
