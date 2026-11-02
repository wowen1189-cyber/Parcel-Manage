import "server-only";
import type { FcAccount, FcTransaction } from "@/lib/bank-feeds";
import { stripe } from "./client";

// Stripe Financial Connections calls, on Parcel Manage's own Stripe account (not a company's connected account):
// the company is the account holder, as a Stripe customer. Only balances and transactions are requested.

type Account = FcAccount & {
  balance: { as_of: number; current: Record<string, number>; cash?: { available: Record<string, number> | null } } | null;
  balance_refresh: { status: "pending" | "succeeded" | "failed"; next_refresh_available_at: number | null } | null;
  transaction_refresh: { id: string; status: "pending" | "succeeded" | "failed" } | null;
  subscriptions?: string[];
};

/** The Stripe customer that holds this company's bank links (made once). */
export async function holderFor(company: { id: string; name: string; office_email: string | null }) {
  const c = await stripe<{ id: string }>("POST", "customers", { name: company.name, email: company.office_email ?? undefined, "metadata[company_id]": company.id, "metadata[purpose]": "bank_feeds" }, null, `fc-holder-${company.id}`);
  return c.id;
}

/** A session for Stripe's bank sign-in window. */
export async function createLinkSession(customerId: string) {
  return stripe<{ id: string; client_secret: string }>("POST", "financial_connections/sessions", {
    "account_holder[type]": "customer",
    "account_holder[customer]": customerId,
    "permissions[0]": "balances",
    "permissions[1]": "transactions",
    "prefetch[0]": "balances",
    "prefetch[1]": "transactions",
    "filters[countries][0]": "US",
  });
}

export async function getSessionAccounts(sessionId: string): Promise<{ customer: string | null; accounts: FcAccount[] }> {
  const s = await stripe<{ account_holder: { customer?: string } | null; accounts: { data: FcAccount[] } }>("GET", `financial_connections/sessions/${sessionId}`);
  return { customer: s.account_holder?.customer ?? null, accounts: s.accounts.data };
}

export const getAccount = (id: string) => stripe<Account>("GET", `financial_connections/accounts/${id}`);

/** Daily transaction updates from Stripe (also starts a refresh now). */
export const subscribeTransactions = (id: string) => stripe<Account>("POST", `financial_connections/accounts/${id}/subscribe`, { "features[0]": "transactions" });

/** Ask the bank for a fresh balance (a Stripe charge each time); the result arrives a moment later. */
export const refreshBalance = (id: string) => stripe<Account>("POST", `financial_connections/accounts/${id}/refresh`, { "features[0]": "balance" });

export const disconnect = (id: string) => stripe<Account>("POST", `financial_connections/accounts/${id}/disconnect`);

/** Every transaction Stripe has for the account, newest first (Stripe keeps up to 180 days). */
export async function listTransactions(accountId: string, sinceUnix?: number): Promise<FcTransaction[]> {
  const out: FcTransaction[] = [];
  let after: string | undefined;
  for (let page = 0; page < 50; page++) {
    const r = await stripe<{ data: FcTransaction[]; has_more: boolean }>("GET", "financial_connections/transactions", {
      account: accountId,
      limit: 100,
      starting_after: after,
      "transacted_at[gte]": sinceUnix,
    });
    out.push(...r.data);
    if (!r.has_more || !r.data.length) break;
    after = r.data[r.data.length - 1].id;
  }
  return out;
}

/** The bank's current balance in cents, if Stripe has one. */
export function currentBalance(a: Account): { cents: number; asOf: string } | null {
  const usd = a.balance?.current?.usd;
  return a.balance && typeof usd === "number" ? { cents: usd, asOf: new Date(a.balance.as_of * 1000).toISOString() } : null;
}
