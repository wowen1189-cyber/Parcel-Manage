import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, CardHeader, Notice, PageHeader, Pill } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { reverseJournalEntry } from "../actions";

export const metadata = { title: "Journal entry" };

export default async function JournalEntryPage({ params, searchParams }: PageProps<"/journal-entries/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const { data: e } = await supabase
    .from("journal_entry")
    .select("id, entry_date, memo, source, status, posted_at, reversal_of, entity(id, name), journal_line(id, debit_cents, credit_cents, memo, gl_account(number, name), property(name), unit(label))")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!e) notFound();
  const { data: reversedBy } = await supabase.from("journal_entry").select("id").eq("reversal_of", e.id).maybeSingle();
  const canReverse = ["admin", "accountant"].includes(membership.role) && e.status === "posted" && !e.reversal_of;
  const total = e.journal_line.reduce((s, l) => s + Number(l.debit_cents), 0);

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href={`/journal-entries?owner=${e.entity.id}`} className="font-semibold text-accent hover:underline">
          ← Journal entries
        </Link>
      </p>
      <PageHeader title={e.memo} subtitle={`${e.entity.name} · ${date(e.entry_date)} · ${money(total)}`} action={e.status === "reversed" ? <Pill>Reversed</Pill> : <Pill tone="success">Posted</Pill>} />
      {sp.posted && <Notice tone="success">Posted.</Notice>}
      {typeof sp.error === "string" && <Notice tone="danger">{sp.error}</Notice>}
      {e.reversal_of && (
        <Notice>
          This entry reverses{" "}
          <Link href={`/journal-entries/${e.reversal_of}`} className="font-semibold underline">
            an earlier entry
          </Link>
          .
        </Notice>
      )}
      {reversedBy && (
        <Notice>
          Reversed by{" "}
          <Link href={`/journal-entries/${reversedBy.id}`} className="font-semibold underline">
            this entry
          </Link>
          .
        </Notice>
      )}
      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Lines" />
        <Table minWidth={560}>
          <Thead>
            <Th>Account</Th>
            <Th>Property</Th>
            <Th right>Debit</Th>
            <Th right>Credit</Th>
          </Thead>
          <Tbody>
            {e.journal_line.map((l) => (
              <tr key={l.id}>
                <Td>
                  <span className="tabular mr-2 text-subtle">{l.gl_account.number}</span>
                  {l.gl_account.name}
                  {l.memo && <p className="text-[12px] text-subtle">{l.memo}</p>}
                </Td>
                <Td className="text-[13px]">{[l.property?.name, l.unit?.label].filter(Boolean).join(" · ") || "—"}</Td>
                <Td right>{Number(l.debit_cents) ? money(Number(l.debit_cents)) : ""}</Td>
                <Td right>{Number(l.credit_cents) ? money(Number(l.credit_cents)) : ""}</Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </Card>
      {canReverse && (
        <Card className="mt-6">
          <CardHeader title="Reverse this entry" description="Posts an equal and opposite entry today. Use it to undo a mistake, then post the corrected entry." />
          <form action={reverseJournalEntry} className="flex flex-wrap items-end gap-3 px-5 py-4">
            <input type="hidden" name="id" value={e.id} />
            <label className="min-w-64 flex-1 text-[13px] font-semibold text-ink-2">
              Why
              <input name="memo" placeholder="Posted to the wrong owner" className="mt-1.5 block min-h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm" />
            </label>
            <Button type="submit" small variant="secondary">
              Reverse entry
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
