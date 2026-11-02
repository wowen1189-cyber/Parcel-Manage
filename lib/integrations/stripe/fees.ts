// Card fees (CLAUDE.md rule 6, shown before the tenant pays). Only credit cards carry a fee: card network rules
// don't allow a surcharge on debit or prepaid cards, and bank transfers (ACH) are always free to tenants.
// The fee is what the processor charges the company for that payment, never more than Visa's 3% US cap
// (Wesley Owen, Nov 2, 2026: "credit at cost, debit free").
export const CARD_SURCHARGE_CAP_PERCENT = 3;

/**
 * The credit card fee for a payment: the processor's cost on the total charged (percent + fixed part), so the
 * company receives the full payment, capped at 3% of the payment. Debit, prepaid or unknown cards: no fee.
 */
export function cardFeeCents(amountCents: number, funding: string, cost: { percent: number; fixedCents: number }): number {
  if (funding !== "credit" || amountCents <= 0) return 0;
  const gross = Math.ceil((amountCents + cost.fixedCents) / (1 - cost.percent / 100));
  const cap = Math.floor((amountCents * CARD_SURCHARGE_CAP_PERCENT) / 100);
  return Math.max(0, Math.min(gross - amountCents, cap));
}

/** Stripe-Signature header check (scheme v1: HMAC-SHA256 of "timestamp.payload"), within 5 minutes. */
export function parseStripeSignature(header: string | null): { t: number; v1: string[] } | null {
  if (!header) return null;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]).filter(([k]) => k === "t"));
  const v1 = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  const t = Number(parts.t);
  return Number.isFinite(t) && v1.length ? { t, v1 } : null;
}
