// Card convenience fee: shown before the tenant pays (CLAUDE.md rule 6). Bank transfers (ACH) are free to tenants.
export function cardFeeCents(amountCents: number, percent: number): number {
  return Math.round((amountCents * percent) / 100);
}

/** Stripe-Signature header check (scheme v1: HMAC-SHA256 of "timestamp.payload"), within 5 minutes. */
export function parseStripeSignature(header: string | null): { t: number; v1: string[] } | null {
  if (!header) return null;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]).filter(([k]) => k === "t"));
  const v1 = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  const t = Number(parts.t);
  return Number.isFinite(t) && v1.length ? { t, v1 } : null;
}
