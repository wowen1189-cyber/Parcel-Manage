import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { parseStripeSignature } from "./fees";

// Minimal Stripe REST client (form-encoded requests, no SDK). Parcel Manage is the Connect platform; each
// company's payments run on its own connected account (Stripe-Account header), so money goes to the company.

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

type Params = Record<string, string | number | boolean | undefined | null>;

function encode(params: Params): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

/** One Stripe API call. `idempotencyKey` makes a repeated POST (a double tap) return the first result. */
export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST", path: string, params: Params = {}, account?: string | null, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe isn't set up for Parcel Manage yet.");
  const body = encode(params);
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", ...(account ? { "Stripe-Account": account } : {}), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: method === "POST" ? body : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe error ${res.status}`);
  return json as T;
}

/** Verify a webhook came from Stripe (STRIPE_WEBHOOK_SECRET) and is recent. */
export function verifyStripeWebhook(rawBody: string, header: string | null, now = Date.now()): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = parseStripeSignature(header);
  if (!secret || !sig || Math.abs(now / 1000 - sig.t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${sig.t}.${rawBody}`).digest();
  return sig.v1.some((v) => {
    const got = Buffer.from(v, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
