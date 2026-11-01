// Autopay timing and amount. Pure rules; lib/autopay.ts does the drafting.

/** Due once a month, on or after the tenant's day (so a missed run catches up), never twice in a month. */
export function autopayDue(today: string, dayOfMonth: number, lastRunMonth: string | null): boolean {
  return Number(today.slice(8, 10)) >= dayOfMonth && lastRunMonth !== today.slice(0, 7);
}

/** What to draft: the balance due, capped at the tenant's limit. Nothing under $1. */
export function autopayAmount(balanceCents: number, maxCents: number | null): number {
  const amount = maxCents ? Math.min(balanceCents, maxCents) : balanceCents;
  return amount >= 100 ? amount : 0;
}
