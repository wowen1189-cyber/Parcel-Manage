import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoMatch } from "@/lib/bank-books";
import { feedRows, usageMonth } from "@/lib/bank-feeds";
import { currentBalance, getAccount, listTransactions } from "@/lib/integrations/stripe/financial-connections";
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
