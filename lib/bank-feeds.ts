// Bank feeds through Stripe Financial Connections (Wesley Owen, Nov 2, 2026). A company links its own bank
// accounts through Stripe's window (Stripe holds the bank sign-in); Stripe refreshes transactions daily and
// Parcel Manage brings the posted ones into the bank account's transactions for reconciling. Pure logic here;
// lib/integrations/stripe/financial-connections.ts talks to Stripe, lib/bank-feed-sync.ts writes the rows.

import type { BankRow } from "./bank";

export type FcTransaction = {
  id: string;
  amount: number; // cents, money in positive
  description: string;
  status: "pending" | "posted" | "void";
  transacted_at: number; // unix seconds
  status_transitions?: { posted_at: number | null; void_at: number | null };
};

export type FcAccount = { id: string; last4: string | null; institution_name: string; display_name?: string | null; category?: string; status?: string };

/** The day a unix time falls on in the company's time zone. */
export function dayIn(unixSeconds: number, timeZone: string): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-CA", { timeZone });
}

/** Posted transactions as bank rows, keyed by Stripe's id so a transaction is only ever brought in once. */
export function feedRows(txns: FcTransaction[], timeZone: string): (BankRow & { fingerprint: string })[] {
  return txns
    .filter((t) => t.status === "posted")
    .map((t) => ({
      posted_on: dayIn(t.status_transitions?.posted_at ?? t.transacted_at, timeZone),
      description: (t.description || "Bank transaction").slice(0, 300),
      amount_cents: t.amount,
      fingerprint: `fc:${t.id}`,
    }));
}

/**
 * Pair the accounts someone linked in Stripe's window with the company's bank accounts, by last 4 digits.
 * One sign-in at a bank can bring several accounts; any without a match are listed so a person can add them.
 */
export function pairLinked<B extends { id: string; last4: string | null; fc_account_id: string | null }>(linked: FcAccount[], banks: B[]): { pairs: { bank: B; fc: FcAccount }[]; unmatched: FcAccount[] } {
  const pairs: { bank: B; fc: FcAccount }[] = [];
  const unmatched: FcAccount[] = [];
  const taken = new Set<string>();
  for (const fc of linked) {
    const bank = banks.find((b) => !taken.has(b.id) && b.last4 && b.last4 === fc.last4 && (!b.fc_account_id || b.fc_account_id === fc.id));
    if (bank) {
      taken.add(bank.id);
      pairs.push({ bank, fc });
    } else unmatched.push(fc);
  }
  return { pairs, unmatched };
}

/**
 * The balance at the end of an earlier day, worked back from the bank's current balance: take off everything
 * that posted after that day. Used for opening balances on the switch date.
 */
export function balanceAtEndOf(day: string, currentCents: number, rows: { posted_on: string; amount_cents: number }[]): number {
  return currentCents - rows.filter((r) => r.posted_on > day).reduce((s, r) => s + r.amount_cents, 0);
}

/** "2026-11-01": the usage row a moment counts toward. */
export const usageMonth = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;
