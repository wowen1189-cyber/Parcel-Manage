import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Notice, PageHeader, Pill, StatTile } from "@/components/ui";
import { param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money, todayIn } from "@/lib/format";
import { previewStatement } from "@/lib/owner-close";
import { StatementDetailView } from "@/components/statement-detail";
import { previousMonth, splitByOwnership } from "@/lib/owner-statements";
import { requireCompany } from "@/lib/session";
import { CloseMonthForm, ReserveForm } from "../../statement-forms";

export const metadata = { title: "Owner statements" };

export default async function StatementsPage({ params, searchParams }: PageProps<"/owners/[id]/statements">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const today = todayIn(company.time_zone);
  const month = /^\d{4}-\d{2}$/.test(param(sp, "month")) ? param(sp, "month") : previousMonth(today);
  const [s, { data: past }] = await Promise.all([previewStatement(supabase, company, id, month), supabase.from("owner_statement").select("id, period_start, totals, sent_at").eq("entity_id", id).eq("company_id", company.id).order("period_start", { ascending: false })]);
  if (!s) notFound();
  const closed = (past ?? []).find((x) => x.period_start === `${month}-01`);
  const canClose = ["admin", "accountant"].includes(membership.role);
  const shares = splitByOwnership(s.totals.distributableCents, s.payees);

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href={`/owners/${id}`} className="font-semibold text-accent hover:underline">
          ← {s.owner.name}
        </Link>
      </p>
      <PageHeader title="Statements and distributions" subtitle={
          s.managed
            ? `${s.owner.name}: monthly close. Fees come from the month's fee bill; distributions are what's left after bills, unpaid fees and the reserve, and the statement must tie to the bank.`
            : `${s.owner.name}: own books. The money stays in the owner's own bank, so there's nothing to distribute; the statement shows income, expenses, fees and owner draws.`
        } />
      <Card className="mb-6 flex flex-wrap items-end gap-3 p-5">
        <form action={`/owners/${id}/statements`} className="flex flex-wrap items-end gap-3">
          <label className="text-[13px] font-semibold text-ink-2">
            Month
            <input type="month" name="month" defaultValue={month} max={today.slice(0, 7)} className="mt-1.5 block min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm" />
          </label>
          <button className="min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-sm font-semibold">Show</button>
        </form>
        <div className="ml-auto">
          <ReserveForm entityId={id} reserve={(s.owner.reserve_cents / 100).toFixed(2)} />
        </div>
      </Card>

      {closed ? (
        <Notice tone="success">
          {month} is closed.{" "}
          <Link href={`/owners/${id}/statements/${closed.id}`} className="font-semibold underline">
            Open the statement
          </Link>
          .
        </Notice>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Gross income collected" value={money(s.properties.reduce((x, p) => x + p.collectedCents, 0))} note={`${date(s.from)} to ${date(s.to)}`} />
            <StatTile label="Fees" value={money(s.totals.feesCents)} note={s.invoice ? `Fee bill #${s.invoice.number}: ${s.invoice.status}` : s.totals.feesCents ? "Not billed yet" : "None this month"} />
            <StatTile label="Ending cash" value={money(s.totals.endingCashCents)} note={`Unpaid bills and fees ${money(s.totals.payablesCents)} · reserve ${money(s.totals.reserveCents)}`} />
            {s.managed ? (
              <StatTile label="Distribution" value={money(s.totals.distributableCents)} note={shares.map((x) => `${x.name} ${x.pct}%`).join(" · ")} />
            ) : (
              <StatTile label="Owner draws" value={money(s.totals.drawsCents ?? 0)} note={`Contributions ${money(s.totals.contributionsCents ?? 0)}`} />
            )}
          </div>
          {s.totals.feesCents > 0 && (!s.invoice || s.invoice.status === "draft") && (
            <div className="mt-4">
              <Notice tone="warn">
                Bill this month&apos;s fees before closing:{" "}
                <Link href={`/fee-billing?month=${month}`} className="font-semibold underline">
                  Fee billing
                </Link>
                .
              </Notice>
            </div>
          )}
          {s.managed && (
            <div className="mt-4">
              <Notice tone={s.tieOut.ok ? "success" : "warn"}>
                {s.tieOut.accounts.length
                  ? s.tieOut.accounts.map((a) => `${a.name}: ${a.through ? `reconciled through ${date(a.through)}` : "never reconciled"}`).join(" · ")
                  : "No operating bank account yet."}{" "}
                {s.tieOut.ok ? "Ties to the bank." : `Reconcile through ${date(s.to)} before closing, so the statement matches the bank.`}
              </Notice>
            </div>
          )}
          <Card className="mt-6 overflow-hidden">
            <CardHeader title={`Preview: ${month}`} description="Nothing is posted until you close the month." />
            <Table minWidth={720}>
              <Thead>
                <Th>Property</Th>
                <Th right>Gross income collected</Th>
                <Th>Fee terms</Th>
                <Th right>Fees</Th>
              </Thead>
              <Tbody>
                {s.properties.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.name}</Td>
                    <Td right>{money(p.collectedCents)}</Td>
                    <Td className="text-[12px] text-subtle">{p.feeTerms}</Td>
                    <Td right>
                      {money(p.managementFeeCents + p.leasingFeeCents)}
                      {p.newLeases > 0 && <p className="text-[12px] text-subtle">incl. leasing or renewal fees for {p.newLeases} lease{p.newLeases === 1 ? "" : "s"}</p>}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
            {canClose && (
              <div className="border-t border-line px-5 py-4">
                <CloseMonthForm entityId={id} month={month} disabled={month >= today.slice(0, 7)} />
                {month >= today.slice(0, 7) && <p className="mt-2 text-[13px] text-subtle">You can close a month once it has ended.</p>}
              </div>
            )}
          </Card>
          <div className="mt-6">
            <StatementDetailView detail={s.detail} />
          </div>
        </>
      )}

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Past statements" />
        {past?.length ? (
          <Table minWidth={520}>
            <Thead>
              <Th>Month</Th>
              <Th right>Distribution</Th>
              <Th>Sent</Th>
            </Thead>
            <Tbody>
              {past.map((x) => (
                <tr key={x.id}>
                  <Td>
                    <RowLink href={`/owners/${id}/statements/${x.id}`}>{x.period_start.slice(0, 7)}</RowLink>
                  </Td>
                  <Td right>{money((x.totals as { distributableCents: number }).distributableCents)}</Td>
                  <Td>{x.sent_at ? <Pill tone="success">Sent {date(x.sent_at.slice(0, 10))}</Pill> : <Pill>Not sent</Pill>}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <p className="px-5 py-4 text-[13px] text-subtle">No months closed yet.</p>
        )}
      </Card>
    </>
  );
}
