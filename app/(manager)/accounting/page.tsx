import Link from "next/link";
import { buttonClass, Card, CardHeader, EmptyState, Notice, PageHeader, Pill, StatTile } from "@/components/ui";
import { param } from "@/components/list-filters";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES, netIncome, normalBalance, trialBalanceTotals, type AccountBalance } from "@/lib/books";
import { date, money, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Accounting" };

// Each owner (LLC) keeps its own books. Pick an owner and a period: balances as of the end date,
// income and expenses for the period, and whether the trust accounts tie out.
export default async function AccountingPage({ searchParams }: PageProps<"/accounting">) {
  const { supabase, company } = await requireCompany();
  const sp = await searchParams;
  const today = todayIn(company.time_zone);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(param(sp, "to")) ? param(sp, "to") : today;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(param(sp, "from")) ? param(sp, "from") : `${to.slice(0, 7)}-01`;
  const { data: owners } = await supabase.from("entity").select("id, name").eq("company_id", company.id).order("name");
  const entity = owners?.find((o) => o.id === param(sp, "owner")) ?? owners?.[0];
  if (!entity) return <PageHeader title="Accounting" subtitle="Add an owner first: each owner keeps its own books." />;

  const [{ data: asOf }, { data: period }] = await Promise.all([
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entity.id, p_from: "1900-01-01", p_to: to }),
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entity.id, p_from: from, p_to: to }),
  ]);
  const balances = (asOf ?? []) as AccountBalance[];
  const activity = (period ?? []) as AccountBalance[];
  const totals = trialBalanceTotals(balances);
  const used = balances.filter((b) => Number(b.debit_cents) || Number(b.credit_cents));
  const get = (n: string) => normalBalance(balances.find((b) => b.number === n) ?? { type: "asset", debit_cents: 0, credit_cents: 0 });
  const trustCash = get("1010");
  const depositsHeld = get("2100");

  return (
    <>
      <PageHeader
        title="Accounting"
        subtitle="Each owner's books, kept double-entry. Posted entries are never edited; mistakes are reversed."
        action={
          <Link href={`/journal-entries/new?owner=${entity.id}`} className={buttonClass("primary", true)}>
            + Journal entry
          </Link>
        }
      />
      <form action="/accounting" className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-[13px] font-semibold text-ink-2">
          Owner
          <select name="owner" defaultValue={entity.id} className="mt-1.5 block min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm">
            {owners!.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-semibold text-ink-2">
          From
          <input type="date" name="from" defaultValue={from} className="mt-1.5 block min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm" />
        </label>
        <label className="text-[13px] font-semibold text-ink-2">
          To
          <input type="date" name="to" defaultValue={to} className="mt-1.5 block min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm" />
        </label>
        <button className={buttonClass("secondary", true)}>Show</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Net income" value={money(netIncome(activity))} note={`${date(from)} to ${date(to)}`} />
        <StatTile label="Operating cash" value={money(get("1000"))} note={`As of ${date(to)}`} />
        <StatTile label="Tenants owe" value={money(get("1100"))} note="Accounts receivable" />
        <StatTile label="Deposits in trust" value={money(trustCash)} note={trustCash === depositsHeld ? "Matches deposits held" : `Deposits held ${money(depositsHeld)}`} />
      </div>
      {trustCash !== depositsHeld && (
        <div className="mt-4">
          <Notice tone="warn">Trust cash ({money(trustCash)}) doesn&apos;t match security deposits held ({money(depositsHeld)}). Florida requires deposits to be held in full (Fla. Stat. 83.49); find the difference before the next statement.</Notice>
        </div>
      )}

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Trial balance"
          description={`${entity.name} · as of ${date(to)}`}
          action={totals.balanced ? <Pill tone="success">Balanced</Pill> : <Pill tone="danger">Out of balance</Pill>}
        />
        {used.length ? (
          <Table minWidth={560}>
            <Thead>
              <Th>Account</Th>
              <Th right>Debit</Th>
              <Th right>Credit</Th>
            </Thead>
            <Tbody>
              {ACCOUNT_TYPES.flatMap((type) => {
                const rows = used.filter((b) => b.type === type);
                if (!rows.length) return [];
                return [
                  <tr key={type} className="bg-surface-muted">
                    <Td className="text-[12px] font-bold uppercase tracking-wide text-subtle">{ACCOUNT_TYPE_LABEL[type]}</Td>
                    <Td />
                    <Td />
                  </tr>,
                  ...rows.map((b) => {
                    const net = Number(b.debit_cents) - Number(b.credit_cents);
                    return (
                      <tr key={b.account_id}>
                        <Td>
                          <Link href={`/journal-entries?owner=${entity.id}&account=${b.number}`} className="hover:underline">
                            <span className="tabular mr-2 text-subtle">{b.number}</span>
                            {b.name}
                          </Link>
                          {b.is_trust && <span className="ml-2"><Pill tone="info">Trust</Pill></span>}
                        </Td>
                        <Td right>{net > 0 ? money(net) : ""}</Td>
                        <Td right>{net < 0 ? money(-net) : ""}</Td>
                      </tr>
                    );
                  }),
                ];
              })}
              <tr className="font-semibold">
                <Td>Total</Td>
                <Td right>{money(used.reduce((s, b) => s + Math.max(0, Number(b.debit_cents) - Number(b.credit_cents)), 0))}</Td>
                <Td right>{money(used.reduce((s, b) => s + Math.max(0, Number(b.credit_cents) - Number(b.debit_cents)), 0))}</Td>
              </tr>
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="No activity yet">Charges, payments and journal entries for {entity.name} will show here.</EmptyState>
        )}
      </Card>
    </>
  );
}
