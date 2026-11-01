import Link from "next/link";
import { buttonClass, Card, CardHeader, EmptyState, Notice } from "@/components/ui";
import { date, money } from "@/lib/format";
import { buildLedger } from "@/lib/ledger";
import { requireTenant } from "@/lib/portal";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: PageProps<"/portal/payments">) {
  const sp = await searchParams;
  const { supabase, lease } = await requireTenant();
  const [{ data: charges }, { data: payments }, { data: full }] = await Promise.all([
    supabase.from("charge").select("id, charge_type, description, amount_cents, due_date, created_at").eq("lease_id", lease.id),
    supabase.from("payment").select("id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at").eq("lease_id", lease.id),
    supabase.from("lease").select("opening_balance_cents, opening_balance_as_of, certified_funds_only").eq("id", lease.id).single(),
  ]);
  const ledger = buildLedger(charges ?? [], payments ?? [], { cents: full?.opening_balance_cents ?? null, asOf: full?.opening_balance_as_of ?? null });
  const rows = [...ledger.rows].reverse();

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold">Payments</h1>
      {sp.paid && <Notice tone="success">Thanks! Your payment is processing. It shows here once it clears (bank transfers take 3–5 business days).</Notice>}
      <Card className="p-5">
        <p className="text-[13px] font-semibold text-subtle">{ledger.balanceCents < 0 ? "Credit on your account" : "You owe"}</p>
        <p className={`mt-1 text-[34px] font-extrabold ${ledger.balanceCents > 0 ? "text-danger" : ""}`}>{money(Math.abs(ledger.balanceCents))}</p>
        <div className="mt-3">
          <Link href="/portal/pay" className={buttonClass("primary")}>
            Pay now
          </Link>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title="Your ledger" description="Every charge and payment, newest first." />
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px]">
                <span>
                  <span className="block font-semibold">{r.description}</span>
                  <span className="text-subtle">{date(r.date)}</span>
                </span>
                <span className="text-right">
                  <span className={`block font-semibold ${r.paymentCents ? "text-accent" : ""}`}>{r.paymentCents ? `−${money(r.paymentCents)}` : money(r.chargeCents)}</span>
                  <span className="text-[12px] text-subtle">balance {money(r.balanceCents)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing here yet" />
        )}
      </Card>
    </div>
  );
}
