import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { suggestMatch } from "@/lib/bank";
import { bankVsBooks } from "@/lib/bank-balances";
import { bookLines } from "@/lib/bank-books";
import { date, money, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { setTransaction } from "../actions";
import { FeedControls } from "../feed-forms";
import { ImportForm, ReconcileForm } from "../forms";

export const metadata = { title: "Bank account" };

export default async function BankAccountPage({ params }: PageProps<"/bank-accounts/[id]">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const { data: a } = await supabase.from("bank_account").select("id, name, institution, last4, gl_number, entity_id, fc_account_id, fc_institution, fc_status, fc_synced_at, fc_balance_cents, fc_balance_as_of, entity(name), reconciliation(id, statement_date, statement_balance_cents, completed_at, automatic)").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!a) notFound();
  const [lines, { data: txs }] = await Promise.all([bookLines(supabase, company.id, a), supabase.from("bank_transaction").select("id, posted_on, description, amount_cents, status, journal_line_id").eq("bank_account_id", id).order("posted_on", { ascending: false }).limit(300)]);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const used = new Set(lines.filter((l) => l.matched || l.cleared).map((l) => l.id));
  const canEdit = ["admin", "accountant"].includes(membership.role);
  const today = todayIn(company.time_zone);
  const b = (await bankVsBooks(supabase, company.id, company.time_zone, [a]))[a.id];
  // What explains a difference: bank items not in the books yet, and book entries the bank hasn't shown yet.
  const bankOnly = (txs ?? []).filter((t) => t.status === "unmatched" && t.posted_on <= b.asOf).reduce((s, t) => s + Number(t.amount_cents), 0);
  const booksOnly = lines.filter((l) => !l.matched && !l.cleared && l.entry_date <= b.asOf).reduce((s, l) => s + l.amount_cents, 0);
  const recs = [...a.reconciliation].sort((x, y) => y.statement_date.localeCompare(x.statement_date));

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/bank-accounts" className="font-semibold text-accent hover:underline">
          ← Bank accounts
        </Link>
      </p>
      <PageHeader title={`${a.name} …${a.last4}`} subtitle={`${a.entity.name} · ${a.gl_number === "1010" ? "Security deposit trust" : "Operating"}${a.institution ? ` · ${a.institution}` : ""}`} />
      {a.fc_account_id ? (
        <Card className="mb-6">
          <CardHeader
            title="Bank feed"
            description={`Connected to ${a.fc_institution ?? "the bank"} through Stripe. New transactions come in every night${a.fc_synced_at ? `; last brought in ${new Date(a.fc_synced_at).toLocaleString("en-US", { timeZone: company.time_zone, dateStyle: "medium", timeStyle: "short" })}` : ""}.`}
          />
          <div className="space-y-3 px-5 py-4">
            {a.fc_balance_cents != null && (
              <p className="text-sm">
                Bank balance: <span className="font-semibold">{money(Number(a.fc_balance_cents))}</span>
                <span className="text-subtle"> as of {a.fc_balance_as_of ? new Date(a.fc_balance_as_of).toLocaleString("en-US", { timeZone: company.time_zone, dateStyle: "medium", timeStyle: "short" }) : "—"}</span>
              </p>
            )}
            {a.fc_status && a.fc_status !== "active" && <p className="text-[13px] font-medium text-danger">The bank connection is {a.fc_status}. Disconnect and connect the bank again.</p>}
            {canEdit && <FeedControls id={a.id} />}
          </div>
        </Card>
      ) : (
        <p className="mb-4 text-[13px] text-muted">
          No bank feed yet.{" "}
          <Link href="/bank-accounts" className="font-semibold text-accent hover:underline">
            Connect the bank
          </Link>{" "}
          for nightly transactions, or import a statement below.
        </p>
      )}
      <Card className="mb-6">
        <CardHeader title="Bank vs Parcel Manage" description={`Both balances on ${date(b.asOf)}.`} />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <StatTile label="Bank balance" value={b.bankCents == null ? "—" : money(b.bankCents)} note={b.bankCents == null ? (a.fc_account_id ? "Press Get today's balance" : "Connect the bank to see it") : "From the bank feed"} />
          <StatTile label="Parcel Manage balance" value={money(b.bookCents)} note={`${a.gl_number === "1010" ? "Trust cash (1010)" : "Operating cash (1000)"} in ${a.entity.name}'s books`} />
          <StatTile label="Difference" value={b.status === "no_bank" ? "—" : b.status === "match" ? "Matches" : money(b.diffCents!)} note={b.status === "off" ? "Bank minus Parcel Manage" : undefined} />
        </div>
        {b.status === "off" && (
          <p className="border-t border-line px-5 py-3 text-[13px] text-muted">
            Usually explained by: bank transactions not in the books yet ({money(bankOnly)}) and book entries the bank hasn&apos;t shown yet ({money(booksOnly)}).{" "}
            {bankOnly - booksOnly === b.diffCents ? "Those account for the whole difference." : `That leaves ${money(b.diffCents! - (bankOnly - booksOnly))} to look into.`}
          </p>
        )}
      </Card>
      {canEdit && (
        <Card className="mb-6">
          <CardHeader title="Import transactions" />
          <div className="px-5 py-4">
            <ImportForm accountId={a.id} />
          </div>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Bank transactions" description="Matched to the books by amount and date." />
          {txs?.length ? (
            <Table minWidth={620}>
              <Thead>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th right>Amount</Th>
                <Th>Books</Th>
              </Thead>
              <Tbody>
                {txs.map((t) => {
                  const line = t.journal_line_id ? byId.get(t.journal_line_id) : null;
                  const suggestion = t.status === "unmatched" ? suggestMatch({ ...t, amount_cents: Number(t.amount_cents) }, lines, used) : null;
                  return (
                    <tr key={t.id}>
                      <Td className="whitespace-nowrap text-[13px]">{date(t.posted_on)}</Td>
                      <Td className="text-[13px]">{t.description}</Td>
                      <Td right className={Number(t.amount_cents) > 0 ? "text-accent" : ""}>
                        {money(Number(t.amount_cents))}
                      </Td>
                      <Td className="text-[12px]">
                        {t.status === "matched" && line ? (
                          <span>
                            <Pill tone="success">Matched</Pill> {line.memo}
                          </span>
                        ) : t.status === "ignored" ? (
                          <Pill>Ignored</Pill>
                        ) : (
                          <span className="flex flex-wrap gap-2">
                            <Pill tone="warn">Not in books</Pill>
                            {canEdit && suggestion && (
                              <form action={setTransaction}>
                                <input type="hidden" name="id" value={t.id} />
                                <input type="hidden" name="action" value="match" />
                                <input type="hidden" name="line_id" value={suggestion.id} />
                                <button className="font-semibold text-accent">Match to {suggestion.memo}</button>
                              </form>
                            )}
                            {canEdit && (
                              <form action={setTransaction}>
                                <input type="hidden" name="id" value={t.id} />
                                <input type="hidden" name="action" value="ignore" />
                                <button className="text-subtle">Ignore</button>
                              </form>
                            )}
                          </span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No transactions imported">Download a statement CSV from your bank and import it above.</EmptyState>
          )}
          <p className="border-t border-line px-5 py-3 text-[12px] text-subtle">Not in books? Post it first (bills, journal entries for bank fees or interest), then it matches.</p>
        </Card>
        <div className="space-y-6">
          {canEdit && (
            <Card>
              <CardHeader title="Reconcile" description="Check every item on the statement. Finish when the difference is $0.00." />
              <div className="px-5 py-4">
                <ReconcileForm
                  key={lines.filter((l) => l.matched || l.cleared).map((l) => l.id).join(",")}
                  accountId={a.id}
                  today={today}
                  clearedBefore={lines.filter((l) => l.cleared).reduce((s, l) => s + l.amount_cents, 0)}
                  lines={lines.filter((l) => !l.cleared).map((l) => ({ id: l.id, date: l.entry_date, memo: l.memo, amount: l.amount_cents, matched: l.matched }))}
                />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Past reconciliations" description={a.fc_account_id ? "With the bank feed, each month reconciles by itself early the next month when everything ties." : undefined} />
            <ul className="divide-y divide-line text-sm">
              {recs.length ? (
                recs.map((r) => (
                  <li key={r.id} className="flex justify-between px-5 py-2.5">
                    <span>
                      {date(r.statement_date)} {r.automatic && <Pill tone="info">Automatic</Pill>}
                    </span>
                    <span>{money(Number(r.statement_balance_cents))}</span>
                  </li>
                ))
              ) : (
                <li className="px-5 py-3 text-[13px] text-subtle">None yet.</li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
