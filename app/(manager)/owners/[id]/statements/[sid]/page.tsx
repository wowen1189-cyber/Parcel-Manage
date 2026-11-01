import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Notice, PageHeader, Pill } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money, todayIn } from "@/lib/format";
import type { StatementProperty, StatementTotals } from "@/lib/owner-statements";
import { requireCompany } from "@/lib/session";
import { EmailStatementButton, PayDistributionForm } from "../../../statement-forms";

export const metadata = { title: "Owner statement" };

export default async function StatementPage({ params, searchParams }: PageProps<"/owners/[id]/statements/[sid]">) {
  const { id, sid } = await params;
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const { data: st } = await supabase.from("owner_statement").select("*, entity(name), owner_distribution(id, payee_name, ownership_pct, amount_cents, status, paid_on, method, reference)").eq("id", sid).eq("entity_id", id).eq("company_id", company.id).maybeSingle();
  if (!st) notFound();
  const t = st.totals as StatementTotals;
  const lines = st.lines as StatementProperty[];
  const month = new Date(`${st.period_start}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const canPay = ["admin", "accountant"].includes(membership.role);
  const row = (label: string, cents: number, strong = false) => (
    <tr>
      <Td className={strong ? "font-semibold" : ""}>{label}</Td>
      <Td right className={strong ? "font-semibold" : ""}>
        {money(cents)}
      </Td>
    </tr>
  );

  return (
    <>
      <div className="print:hidden">
        <p className="mb-2 text-[13px]">
          <Link href={`/owners/${id}/statements`} className="font-semibold text-accent hover:underline">
            ← Statements
          </Link>
        </p>
        <PageHeader title={`${st.entity.name}: ${month}`} subtitle={`Closed ${date(st.created_at.slice(0, 10))}${st.sent_at ? ` · sent ${date(st.sent_at.slice(0, 10))}` : ""}`} action={<PrintButton />} />
        {sp.closed && <Notice tone="success">Month closed: fees posted to the owner&apos;s books and the statement saved.</Notice>}
        <div className="my-4">
          <EmailStatementButton id={st.id} sent={Boolean(st.sent_at)} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Summary" description={`${date(st.period_start)} to ${date(st.period_end)}`} />
          <Table minWidth={320}>
            <Thead>
              <Th>Item</Th>
              <Th right>Amount</Th>
            </Thead>
            <Tbody>
              {row("Beginning cash", t.beginningCashCents)}
              {row("Income", t.incomeCents)}
              {row("Expenses (including fees)", t.expensesCents)}
              {row("Management, leasing and renewal fees", t.feesCents)}
              {row("Ending cash", t.endingCashCents, true)}
              {row("Unpaid bills", t.payablesCents)}
              {row("Cash reserve", t.reserveCents)}
              {row("Distribution", t.distributableCents, true)}
              {row("Security deposits held in trust", t.depositsHeldCents)}
            </Tbody>
          </Table>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="By property" />
          <Table minWidth={320}>
            <Thead>
              <Th>Property</Th>
              <Th right>Collected</Th>
              <Th right>Fees</Th>
            </Thead>
            <Tbody>
              {lines.map((p) => (
                <tr key={p.id}>
                  <Td>{p.name}</Td>
                  <Td right>{money(p.collectedCents)}</Td>
                  <Td right>{money(p.managementFeeCents + p.leasingFeeCents)}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      </div>
      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Distributions" description="Split by ownership percent. Record each payout when it's sent." />
        {st.owner_distribution.length ? (
          <ul className="divide-y divide-line">
            {st.owner_distribution.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-semibold">{d.payee_name}</span> · {Number(d.ownership_pct)}% · {money(d.amount_cents)}
                </span>
                {d.status === "paid" ? (
                  <Pill tone="success">
                    Paid {date(d.paid_on)} {d.method}
                    {d.reference ? ` ${d.reference}` : ""}
                  </Pill>
                ) : canPay ? (
                  <PayDistributionForm id={d.id} today={todayIn(company.time_zone)} />
                ) : (
                  <Pill tone="warn">Pending</Pill>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-[13px] text-subtle">Nothing to distribute this month.</p>
        )}
      </Card>
    </>
  );
}
