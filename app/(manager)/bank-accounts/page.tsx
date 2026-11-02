import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { bankVsBooks } from "@/lib/bank-balances";
import { date, money } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { ConnectBankButton } from "./feed-forms";
import { BalanceCells } from "./balance-cells";
import { NewAccountForm } from "./forms";

export const metadata = { title: "Bank accounts" };

export default async function BankAccountsPage() {
  const { supabase, company, membership } = await requireCompany();
  const [{ data: accounts }, { data: owners }] = await Promise.all([
    supabase.from("bank_account").select("id, name, institution, last4, gl_number, entity_id, fc_account_id, fc_synced_at, fc_balance_cents, fc_balance_as_of, entity(name), reconciliation(statement_date), bank_transaction(status)").eq("company_id", company.id).order("name"),
    supabase.from("entity").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  const balances = await bankVsBooks(supabase, company.id, company.time_zone, accounts ?? []);
  const totalBank = (accounts ?? []).reduce((s, a) => s + (balances[a.id].bankCents ?? 0), 0);
  const totalBooks = (accounts ?? []).reduce((s, a) => s + balances[a.id].bookCents, 0);
  return (
    <>
      <PageHeader title="Bank accounts" subtitle="Each owner's operating and security deposit trust accounts, with the bank's balance next to Parcel Manage's on the same day. Connect the bank (or import statements), match to the books, and reconcile to $0.00." />
      {["admin", "accountant"].includes(membership.role) && (
        <Card className="mb-6">
          <CardHeader
            title="Bank feeds"
            description="Sign in to each bank once in Stripe's secure window (Parcel Manage never sees the bank password). Accounts are matched to the ones below by their last 4 digits, and new transactions come in every night."
          />
          <div className="px-5 py-4">
            <ConnectBankButton />
          </div>
        </Card>
      )}
      <Card className="overflow-hidden">
        {accounts?.length ? (
          <Table minWidth={720}>
            <Thead>
              <Th>Account</Th>
              <Th>Owner</Th>
              <Th>Feed</Th>
              <Th right>Bank balance</Th>
              <Th right>Parcel Manage</Th>
              <Th right>Difference</Th>
              <Th>Unmatched</Th>
              <Th>Last reconciled</Th>
            </Thead>
            <Tbody>
              {accounts.map((a) => {
                const last = [...a.reconciliation].sort((x, y) => y.statement_date.localeCompare(x.statement_date))[0];
                const unmatched = a.bank_transaction.filter((t) => t.status === "unmatched").length;
                return (
                  <tr key={a.id}>
                    <Td>
                      <RowLink href={`/bank-accounts/${a.id}`} sub={[a.institution, `…${a.last4}`].filter(Boolean).join(" · ")}>
                        {a.name}
                      </RowLink>
                      {a.gl_number === "1010" && <Pill tone="info">Trust</Pill>}
                    </Td>
                    <Td className="text-[13px]">{a.entity.name}</Td>
                    <Td className="text-[13px]">{a.fc_account_id ? <Pill tone="success">Connected</Pill> : <span className="text-subtle">Not connected</span>}</Td>
                    <BalanceCells b={balances[a.id]} />
                    <Td>{unmatched ? <Pill tone="warn">{unmatched}</Pill> : "—"}</Td>
                    <Td className="text-[13px]">{last ? date(last.statement_date) : <span className="text-subtle">Never</span>}</Td>
                  </tr>
                );
              })}
              <tr className="bg-surface-muted font-semibold">
                <Td>Total</Td>
                <Td />
                <Td />
                <Td right>{money(totalBank)}</Td>
                <Td right>{money(totalBooks)}</Td>
                <Td />
                <Td />
                <Td />
              </tr>
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="No bank accounts yet">Add each owner&apos;s operating account and its security deposit trust account.</EmptyState>
        )}
      </Card>
      {["admin", "accountant"].includes(membership.role) && (
        <Card className="mt-6">
          <CardHeader title="Add an account" description="Florida requires security deposits in a separate account (83.49); mark that one as trust." />
          <div className="px-5 py-4">
            <NewAccountForm owners={owners ?? []} />
          </div>
        </Card>
      )}
    </>
  );
}

