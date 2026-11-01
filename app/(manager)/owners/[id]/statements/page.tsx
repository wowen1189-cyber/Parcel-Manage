import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Notice, PageHeader, Pill, StatTile } from "@/components/ui";
import { param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money, todayIn } from "@/lib/format";
import { previewStatement } from "@/lib/owner-close";
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
      <PageHeader title="Statements and distributions" subtitle={`${s.owner.name}: monthly close. Fees post from rent actually collected; distributions are what's left after bills and the reserve.`} />
      <Card className="mb-6 p-5">
        <form action={`/owners/${id}/statements`} className="flex flex-wrap items-end gap-3">
          <label className="text-[13px] font-semibold text-ink-2">
            Month
            <input type="month" name="month" defaultValue={month} max={today.slice(0, 7)} className="mt-1.5 block min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm" />
          </label>
          <button className="min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-sm font-semibold">Show</button>
          <div className="ml-auto">
            <ReserveForm entityId={id} reserve={(s.owner.reserve_cents / 100).toFixed(2)} />
          </div>
        </form>
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
            <StatTile label="Rent collected" value={money(s.properties.reduce((x, p) => x + p.collectedCents, 0))} note={`${date(s.from)} to ${date(s.to)}`} />
            <StatTile label="Fees to post" value={money(s.totals.feesCents)} note="Management, leasing and renewal" />
            <StatTile label="Cash after fees" value={money(s.totals.endingCashCents)} note={`Bills ${money(s.totals.payablesCents)} · reserve ${money(s.totals.reserveCents)}`} />
            <StatTile label="Distribution" value={money(s.totals.distributableCents)} note={shares.map((x) => `${x.name} ${x.pct}%`).join(" · ")} />
          </div>
          <Card className="mt-6 overflow-hidden">
            <CardHeader title={`Preview: ${month}`} description="Nothing is posted until you close the month." />
            <Table minWidth={720}>
              <Thead>
                <Th>Property</Th>
                <Th right>Collected</Th>
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
                      {p.newLeases > 0 && <p className="text-[12px] text-subtle">incl. leasing fee for {p.newLeases} new lease{p.newLeases === 1 ? "" : "s"}</p>}
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
