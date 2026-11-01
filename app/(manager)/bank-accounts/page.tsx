import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { NewAccountForm } from "./forms";

export const metadata = { title: "Bank accounts" };

export default async function BankAccountsPage() {
  const { supabase, company, membership } = await requireCompany();
  const [{ data: accounts }, { data: owners }] = await Promise.all([
    supabase.from("bank_account").select("id, name, institution, last4, gl_number, entity(name), reconciliation(statement_date), bank_transaction(status)").eq("company_id", company.id).order("name"),
    supabase.from("entity").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  return (
    <>
      <PageHeader title="Bank accounts" subtitle="Each owner's operating and security deposit trust accounts. Import statements, match them to the books, and reconcile to $0.00." />
      <Card className="overflow-hidden">
        {accounts?.length ? (
          <Table minWidth={720}>
            <Thead>
              <Th>Account</Th>
              <Th>Owner</Th>
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
                    <Td>{unmatched ? <Pill tone="warn">{unmatched}</Pill> : "—"}</Td>
                    <Td className="text-[13px]">{last ? date(last.statement_date) : <span className="text-subtle">Never</span>}</Td>
                  </tr>
                );
              })}
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
