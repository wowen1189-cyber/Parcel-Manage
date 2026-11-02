import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalBalance, type AccountBalance } from "@/lib/books";
import { compareBalances } from "@/lib/bank-feeds";
import type { Database } from "@/lib/supabase/database.types";

// Each bank account's balance at the bank (from its feed) next to its balance in Parcel Manage's books
// (the owner's operating 1000 or trust 1010 account) on the same day.

type Db = SupabaseClient<Database>;
type Account = { id: string; entity_id: string; gl_number: string; fc_balance_cents: number | null; fc_balance_as_of: string | null };

export async function bankVsBooks(db: Db, companyId: string, timeZone: string, accounts: Account[]) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone });
  return Object.fromEntries(
    await Promise.all(
      accounts.map(async (a) => {
        const asOf = a.fc_balance_as_of ? new Date(a.fc_balance_as_of).toLocaleDateString("en-CA", { timeZone }) : today;
        const { data } = await db.rpc("account_balances", { p_company: companyId, p_entity: a.entity_id, p_from: "1900-01-01", p_to: asOf });
        const row = ((data ?? []) as AccountBalance[]).find((r) => r.number === a.gl_number);
        const bookCents = row ? normalBalance(row) : 0;
        const bankCents = a.fc_balance_cents == null ? null : Number(a.fc_balance_cents);
        return [a.id, { asOf, bookCents, bankCents, ...compareBalances(bankCents, bookCents) }] as const;
      }),
    ),
  );
}
