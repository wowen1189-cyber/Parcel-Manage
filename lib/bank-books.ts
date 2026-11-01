import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookLine } from "@/lib/bank";
import type { Database } from "@/lib/supabase/database.types";

// Book lines on a bank account's cash account (operating 1000 or trust 1010) for its owner, signed the way the
// bank sees them (money in positive), with whether each is already matched or cleared.
type Db = SupabaseClient<Database>;

export async function bookLines(supabase: Db, companyId: string, account: { entity_id: string; gl_number: string }, upTo?: string) {
  let q = supabase
    .from("journal_line")
    .select("id, debit_cents, credit_cents, memo, journal_entry!inner(entry_date, memo, entity_id, status), gl_account!inner(number)")
    .eq("company_id", companyId)
    .eq("journal_entry.entity_id", account.entity_id)
    .eq("gl_account.number", account.gl_number)
    .order("journal_entry(entry_date)", { ascending: true })
    .limit(2000);
  if (upTo) q = q.lte("journal_entry.entry_date", upTo);
  const [{ data: lines }, { data: matched }, { data: cleared }] = await Promise.all([
    q,
    supabase.from("bank_transaction").select("journal_line_id").eq("company_id", companyId).not("journal_line_id", "is", null),
    supabase.from("bank_cleared_line").select("journal_line_id").eq("company_id", companyId),
  ]);
  const matchedSet = new Set((matched ?? []).map((m) => m.journal_line_id!));
  const clearedSet = new Set((cleared ?? []).map((c) => c.journal_line_id));
  return (lines ?? []).map((l) => ({
    id: l.id,
    entry_date: l.journal_entry.entry_date,
    memo: l.memo || l.journal_entry.memo,
    amount_cents: Number(l.debit_cents) - Number(l.credit_cents),
    matched: matchedSet.has(l.id),
    cleared: clearedSet.has(l.id),
  })) as (BookLine & { matched: boolean; cleared: boolean })[];
}
