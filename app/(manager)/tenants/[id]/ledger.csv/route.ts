import type { NextRequest } from "next/server";
import { csvMoney, csvResponse } from "@/lib/csv";
import { csvDate } from "@/lib/format";
import { buildLedger } from "@/lib/ledger";
import { requireCompany } from "@/lib/session";

export async function GET(_: NextRequest, { params }: RouteContext<"/tenants/[id]/ledger.csv">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data: l } = await supabase
    .from("lease")
    .select("opening_balance_cents, opening_balance_as_of, charge(id, charge_type, description, amount_cents, due_date, created_at), payment(id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!l) return new Response("Not found", { status: 404 });
  const { rows } = buildLedger(l.charge, l.payment, { cents: l.opening_balance_cents, asOf: l.opening_balance_as_of });
  return csvResponse("tenant-ledger.csv", ["Date", "Item", "Charge", "Payment", "Balance"], rows.map((r) => [csvDate(r.date), r.description, r.chargeCents ? csvMoney(r.chargeCents) : "", r.paymentCents ? csvMoney(r.paymentCents) : "", csvMoney(r.balanceCents)]));
}
