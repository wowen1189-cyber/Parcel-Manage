import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoMatch, bookLines } from "@/lib/bank-books";
import { autoReconcile, balanceAtEndOf, feedRows, lastMonthEnd, usageMonth } from "@/lib/bank-feeds";
import { currentBalance, getAccount, listTransactions, refreshBalance } from "@/lib/integrations/stripe/financial-connections";
import type { Database } from "@/lib/supabase/database.types";

// Brings a linked bank account's posted transactions in from Stripe (each once, by Stripe's id), matches them to
// the books, and records any balance Stripe already has. Used by the nightly job, the webhook and "Sync now".

type Db = SupabaseClient<Database>;
type Linked = { id: string; company_id: string; fc_account_id: string | null; fc_synced_at: string | null };

export async function syncFeed(db: Db, account: Linked, timeZone: string): Promise<{ added: number; matched: number; error?: string }> {
  if (!account.fc_account_id) return { added: 0, matched: 0 };
  try {
    const fc = await getAccount(account.fc_account_id);
    // After the first pull, look back a week so late-posting transactions are caught; repeats are skipped.
    const since = account.fc_synced_at ? Math.floor(new Date(account.fc_synced_at).getTime() / 1000) - 7 * 86_400 : undefined;
    const rows = feedRows(await listTransactions(account.fc_account_id, since), timeZone).map((r) => ({ ...r, company_id: account.company_id, bank_account_id: account.id }));
    const { data, error } = rows.length ? await db.from("bank_transaction").upsert(rows, { onConflict: "bank_account_id,fingerprint", ignoreDuplicates: true }).select("id") : { data: [], error: null };
    if (error) return { added: 0, matched: 0, error: error.message };
    const matched = await autoMatch(db, account.company_id, account.id);
    const bal = currentBalance(fc);
    await db
      .from("bank_account")
      .update({ fc_status: fc.status ?? null, fc_synced_at: new Date().toISOString(), ...(bal ? { fc_balance_cents: bal.cents, fc_balance_as_of: bal.asOf } : {}) })
      .eq("id", account.id);
    return { added: data?.length ?? 0, matched };
  } catch (e) {
    return { added: 0, matched: 0, error: e instanceof Error ? e.message : "Couldn't reach the bank feed." };
  }
}

/** Record how many accounts the company has linked this month (the most at once), for software billing. */
export async function countLinked(db: Db, companyId: string) {
  const { count } = await db.from("bank_account").select("id", { count: "exact", head: true }).eq("company_id", companyId).not("fc_account_id", "is", null);
  const month = usageMonth();
  const { data: row } = await db.from("bank_feed_usage").select("linked_accounts").eq("company_id", companyId).eq("month", month).maybeSingle();
  if (!row) await db.from("bank_feed_usage").insert({ company_id: companyId, month, linked_accounts: count ?? 0 });
  else if ((count ?? 0) > row.linked_accounts) await db.from("bank_feed_usage").update({ linked_accounts: count ?? 0 }).eq("company_id", companyId).eq("month", month);
}

type Reconcilable = Linked & { entity_id: string; gl_number: string; fc_balance_cents: number | null; fc_balance_as_of: string | null };

/**
 * Early each month, reconcile last month by itself when it ties (lib/bank-feeds.ts autoReconcile). It needs the
 * bank's balance from after the month ended, so on the 1st and 3rd it asks the bank for one (10¢ each).
 */
export async function monthEndReconcile(db: Db, a: Reconcilable, timeZone: string): Promise<"done" | "already" | "waiting" | "left"> {
  if (!a.fc_account_id) return "left";
  const today = new Date().toLocaleDateString("en-CA", { timeZone });
  const monthEnd = lastMonthEnd(today);
  const { data: last } = await db.from("reconciliation").select("statement_date").eq("bank_account_id", a.id).gte("statement_date", monthEnd).limit(1);
  if (last?.length) return "already";
  const day = Number(today.slice(8));
  const balanceDay = a.fc_balance_as_of ? new Date(a.fc_balance_as_of).toLocaleDateString("en-CA", { timeZone }) : null;
  if (!balanceDay || balanceDay <= monthEnd || a.fc_balance_cents == null) {
    if (day === 1 || day === 3) {
      try {
        await refreshBalance(a.fc_account_id);
        const month = usageMonth();
        const { data: u } = await db.from("bank_feed_usage").select("balance_pulls").eq("company_id", a.company_id).eq("month", month).maybeSingle();
        if (u) await db.from("bank_feed_usage").update({ balance_pulls: u.balance_pulls + 1 }).eq("company_id", a.company_id).eq("month", month);
        else await db.from("bank_feed_usage").insert({ company_id: a.company_id, month, balance_pulls: 1 });
      } catch {
        // The bank didn't answer; tomorrow's run (or a person) tries again.
      }
    }
    return "waiting";
  }
  const [{ data: txns }, lines] = await Promise.all([
    db.from("bank_transaction").select("posted_on, status, journal_line_id, amount_cents, fingerprint").eq("bank_account_id", a.id),
    bookLines(db, a.company_id, a, monthEnd),
  ]);
  const fed = (txns ?? []).filter((t) => t.fingerprint.startsWith("fc:")).map((t) => ({ posted_on: t.posted_on, amount_cents: Number(t.amount_cents) }));
  const bankAtEnd = balanceAtEndOf(monthEnd, Number(a.fc_balance_cents), fed);
  const r = autoReconcile({ monthEnd, bankBalanceCents: bankAtEnd, bankTxns: txns ?? [], bookLines: lines });
  if (!r.ok) return "left";
  const { data: rec, error } = await db
    .from("reconciliation")
    .insert({ company_id: a.company_id, bank_account_id: a.id, statement_date: monthEnd, statement_balance_cents: bankAtEnd, cleared_balance_cents: r.clearedCents, completed_by: null, automatic: true })
    .select("id")
    .single();
  if (error) return "left";
  if (r.clear.length) await db.from("bank_cleared_line").insert(r.clear.map((id) => ({ journal_line_id: id, company_id: a.company_id, reconciliation_id: rec.id })));
  return "done";
}
