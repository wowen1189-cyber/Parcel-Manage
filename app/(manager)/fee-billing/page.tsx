import Link from "next/link";
import { Card, CardHeader, EmptyState, Notice, PageHeader, Pill, StatTile } from "@/components/ui";
import { param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { canBill, FEE_BILL_STATUS as STATUS, feeTotal, type FeeLine } from "@/lib/fee-billing";
import { managerEntity, ownerMonthFees } from "@/lib/fee-billing-data";
import { date, money, todayIn } from "@/lib/format";
import { previousMonth } from "@/lib/owner-statements";
import { requireCompany } from "@/lib/session";
import { CreateBillsForm, SetUpManagerForm } from "./forms";

export const metadata = { title: "Fee billing" };

// The management company bills each owner every month: the management fee on gross income collected, plus
// leasing and renewal fees (lib/fee-billing.ts).
export default async function FeeBillingPage({ searchParams }: PageProps<"/fee-billing">) {
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const today = todayIn(company.time_zone);
  const month = /^\d{4}-\d{2}$/.test(param(sp, "month")) ? param(sp, "month") : previousMonth(today);
  const manager = await managerEntity(supabase, company.id);
  const canBillHere = ["admin", "accountant"].includes(membership.role);
  const [{ data: owners }, { data: bills }, { data: managerBank }] = await Promise.all([
    supabase.from("entity").select("id, name, books_mode").eq("company_id", company.id).eq("is_manager", false).order("name"),
    supabase.from("fee_invoice").select("id, number, owner_entity_id, period_start, total_cents, status, paid_on, sent_at, entity:entity!fee_invoice_owner_entity_id_fkey(name)").eq("company_id", company.id).order("number", { ascending: false }).limit(200),
    manager ? supabase.from("bank_account").select("name, last4").eq("entity_id", manager.id) : Promise.resolve({ data: [] }),
  ]);
  const previews = (await Promise.all((owners ?? []).map(async (o) => ({ owner: o, fees: await ownerMonthFees(supabase, company, o.id, month) })))).filter((p) => p.fees?.properties.length);
  const thisMonth = (bills ?? []).filter((b) => b.period_start === `${month}-01` && b.status !== "void");
  const unpaid = (bills ?? []).filter((b) => b.status === "approved");

  return (
    <>
      <PageHeader title="Fee billing" subtitle="Bill each owner the month's management fee (on gross income collected: rent, fees, reimbursements and other income), leasing and renewal fees. Approve each bill, then record the payment into the management company's account." />

      {!manager ? (
        <Card className="p-5">
          <CardHeader title="Set up the management company's books" description="Fees are billed from, and paid into, the management company's own books and bank account. It owns no properties and doesn't show as an owner." />
          <div className="px-5 pb-5">{canBillHere ? <SetUpManagerForm suggested={company.legal_name ?? company.name} /> : <p className="text-[13px] text-subtle">Ask an admin or accountant to set this up.</p>}</div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Billed from" value={manager.name} note={(managerBank ?? []).map((b) => `${b.name} …${b.last4}`).join(" · ") || "No bank account yet"} />
          <StatTile label="Unpaid fee bills" value={money(unpaid.reduce((s, b) => s + b.total_cents, 0))} note={`${unpaid.length} bill${unpaid.length === 1 ? "" : "s"}`} />
          <StatTile label={`Fees for ${month}`} value={money(previews.reduce((s, p) => s + (p.fees ? feeTotal(p.fees.lines) : 0), 0))} note="All owners, before billing" />
        </div>
      )}
      {manager && !(managerBank ?? []).length && (
        <div className="mt-4">
          <Notice tone="warn">
            Add the management company&apos;s bank account under{" "}
            <Link href="/bank-accounts" className="font-semibold underline">
              Bank accounts
            </Link>{" "}
            (owner: {manager.name}) so fee payments can be reconciled.
          </Notice>
        </div>
      )}

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title={`Fees for ${month}`}
          action={
            <form action="/fee-billing" className="flex items-end gap-2">
              <input type="month" name="month" defaultValue={month} max={today.slice(0, 7)} aria-label="Month" className="min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm" />
              <button className="min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-sm font-semibold">Show</button>
            </form>
          }
        />
        <Table minWidth={760}>
          <Thead>
            <Th>Owner</Th>
            <Th right>Gross income collected</Th>
            <Th right>Management</Th>
            <Th right>Leasing and renewal</Th>
            <Th right>Total</Th>
            <Th>Bill</Th>
          </Thead>
          <Tbody>
            {previews.map(({ owner, fees }) => {
              const bill = thisMonth.find((b) => b.owner_entity_id === owner.id);
              const lines: FeeLine[] = fees?.lines ?? [];
              const of = (kinds: string[]) => lines.filter((l) => kinds.includes(l.kind)).reduce((s, l) => s + l.amountCents, 0);
              return (
                <tr key={owner.id}>
                  <Td>
                    <RowLink href={`/owners/${owner.id}`} sub={owner.books_mode === "own_books" ? "Own books" : "Managed: distributions"}>
                      {owner.name}
                    </RowLink>
                  </Td>
                  <Td right>{money(fees?.properties.reduce((s, p) => s + p.grossCents, 0) ?? 0)}</Td>
                  <Td right>{money(of(["management"]))}</Td>
                  <Td right>{money(of(["leasing", "renewal"]))}</Td>
                  <Td right className="font-semibold">
                    {money(bill ? bill.total_cents : feeTotal(lines))}
                  </Td>
                  <Td>
                    {bill ? (
                      <Link href={`/fee-billing/${bill.id}`} className="inline-flex items-center gap-2 font-semibold text-accent hover:underline">
                        #{bill.number} <Pill tone={STATUS[bill.status].tone}>{STATUS[bill.status].label}</Pill>
                      </Link>
                    ) : lines.length ? (
                      <span className="text-[13px] text-subtle">Not billed</span>
                    ) : (
                      <span className="text-[13px] text-subtle">No fees</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
        {manager && canBillHere && (
          <div className="border-t border-line px-5 py-4">
            <CreateBillsForm month={month} disabled={!canBill(month, today)} />
            {!canBill(month, today) && <p className="mt-2 text-[13px] text-subtle">You can bill a month once it has ended.</p>}
          </div>
        )}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="All fee bills" />
        {bills?.length ? (
          <Table minWidth={620}>
            <Thead>
              <Th>Bill</Th>
              <Th>Owner</Th>
              <Th>Month</Th>
              <Th right>Total</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <Td>
                    <RowLink href={`/fee-billing/${b.id}`}>#{b.number}</RowLink>
                  </Td>
                  <Td>{b.entity.name}</Td>
                  <Td>{b.period_start.slice(0, 7)}</Td>
                  <Td right>{money(b.total_cents)}</Td>
                  <Td>
                    <Pill tone={STATUS[b.status].tone}>{b.status === "paid" && b.paid_on ? `Paid ${date(b.paid_on)}` : STATUS[b.status].label}</Pill>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="No fee bills yet">Pick a month that has ended and make the draft bills.</EmptyState>
        )}
      </Card>
    </>
  );
}
