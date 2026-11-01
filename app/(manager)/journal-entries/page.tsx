import Link from "next/link";
import { buttonClass, Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Journal entries" };

const SOURCE: Record<string, string> = { manual: "Manual", charge: "Charge", payment: "Payment", reversal: "Reversal", opening: "Opening balance", bill: "Bill", distribution: "Distribution", fee: "Management fee" };

export default async function JournalEntriesPage({ searchParams }: PageProps<"/journal-entries">) {
  const { supabase, company } = await requireCompany();
  const sp = await searchParams;
  const owner = param(sp, "owner");
  const source = param(sp, "source");
  const account = param(sp, "account");
  const { data: owners } = await supabase.from("entity").select("id, name").eq("company_id", company.id).order("name");
  let q = supabase
    .from("journal_entry")
    .select(`id, entry_date, memo, source, status, entity(name), journal_line${account ? "!inner" : ""}(debit_cents, credit_cents, gl_account${account ? "!inner" : ""}(number))`)
    .eq("company_id", company.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (owner) q = q.eq("entity_id", owner);
  if (source) q = q.eq("source", source);
  if (account) q = q.eq("journal_line.gl_account.number", account);
  const { data: entries } = await q;

  return (
    <>
      <PageHeader
        title="Journal entries"
        subtitle="Every posted entry, newest first. To fix one, reverse it and post a corrected entry."
        action={
          <Link href={`/journal-entries/new${owner ? `?owner=${owner}` : ""}`} className={buttonClass("primary", true)}>
            + New entry
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <form action="/journal-entries" className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
          <select name="owner" defaultValue={owner} aria-label="Owner" className="min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm">
            <option value="">Owner: all</option>
            {(owners ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select name="source" defaultValue={source} aria-label="Type" className="min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm">
            <option value="">Type: all</option>
            {Object.entries(SOURCE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {account && <input type="hidden" name="account" value={account} />}
          <button className={buttonClass("secondary", true)}>Filter</button>
          {account && (
            <span className="text-[13px] text-subtle">
              Account {account} ·{" "}
              <Link href={`/journal-entries${owner ? `?owner=${owner}` : ""}`} className="font-semibold text-accent">
                clear
              </Link>
            </span>
          )}
        </form>
        {entries?.length ? (
          <Table minWidth={760}>
            <Thead>
              <Th>Date</Th>
              <Th>Memo</Th>
              <Th>Owner</Th>
              <Th>Type</Th>
              <Th right>Amount</Th>
            </Thead>
            <Tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap">{date(e.entry_date)}</Td>
                  <Td>
                    <RowLink href={`/journal-entries/${e.id}`}>{e.memo}</RowLink>
                    {e.status === "reversed" && <Pill tone="neutral">Reversed</Pill>}
                  </Td>
                  <Td className="text-[13px]">{e.entity.name}</Td>
                  <Td className="text-[13px]">{SOURCE[e.source] ?? e.source}</Td>
                  <Td right>{money(e.journal_line.reduce((s, l) => s + Number(l.debit_cents), 0))}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="No entries yet">Charges, payments and manual entries appear here as they post.</EmptyState>
        )}
      </Card>
    </>
  );
}
