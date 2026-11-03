import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Pill } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { StatementDetailView } from "@/components/statement-detail";
import { date, money } from "@/lib/format";
import type { StatementProperty, StatementTotals } from "@/lib/owner-statements";
import { requireOwner } from "@/lib/portal";

export const metadata = { title: "Statement" };

export default async function OwnerStatementPage({ params }: PageProps<"/owner/statements/[id]">) {
  const { id } = await params;
  const { supabase } = await requireOwner();
  const { data: st } = await supabase.from("owner_statement").select("*, entity(name), owner_distribution(id, payee_name, ownership_pct, amount_cents, status, paid_on)").eq("id", id).maybeSingle();
  if (!st) notFound();
  const t = st.totals as StatementTotals;
  const lines = st.lines as StatementProperty[];
  const month = new Date(`${st.period_start}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const rows: [string, number][] = [
    ["Beginning cash", t.beginningCashCents],
    ["Income", t.incomeCents],
    ["Expenses (including fees)", t.expensesCents],
    ["Management, leasing and renewal fees", t.feesCents],
    ["Ending cash", t.endingCashCents],
    ["Unpaid bills", t.payablesCents],
    ["Cash reserve", t.reserveCents],
    ["Distribution", t.distributableCents],
    ["Security deposits held in trust", t.depositsHeldCents],
  ];
  return (
    <div className="space-y-6">
      <p className="text-[14px] print:hidden">
        <Link href="/owner" className="font-semibold text-accent">
          ← Overview
        </Link>
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[26px] font-extrabold">
          {st.entity.name}: {month}
        </h1>
        <PrintButton />
      </div>
      <Card>
        <CardHeader title="Summary" description={`${date(st.period_start)} to ${date(st.period_end)}`} />
        <dl className="divide-y divide-line">
          {rows.map(([label, cents]) => (
            <div key={label} className="flex justify-between px-5 py-2.5 text-[15px]">
              <dt>{label}</dt>
              <dd className="font-semibold">{money(cents)}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <CardHeader title="By property" />
        <ul className="divide-y divide-line">
          {lines.map((p) => (
            <li key={p.id} className="flex justify-between px-5 py-2.5 text-[15px]">
              <span>{p.name}</span>
              <span>
                collected {money(p.collectedCents)} · fees {money(p.managementFeeCents + p.leasingFeeCents)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {t.detail && <StatementDetailView detail={t.detail} />}
      <Card>
        <CardHeader title="Distributions" />
        <ul className="divide-y divide-line">
          {st.owner_distribution.map((d) => (
            <li key={d.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5 text-[15px]">
              <span>
                {d.payee_name} · {Number(d.ownership_pct)}%
              </span>
              <span>
                {money(d.amount_cents)} <Pill tone={d.status === "paid" ? "success" : "warn"}>{d.status === "paid" ? `Paid ${date(d.paid_on)}` : "Pending"}</Pill>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
