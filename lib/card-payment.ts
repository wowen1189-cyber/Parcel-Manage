import "server-only";
import { readBusinessRules } from "@/lib/business-rules";
import { stripe } from "@/lib/integrations/stripe/client";
import { cardFeeCents } from "@/lib/integrations/stripe/fees";
import { recordOnline } from "@/lib/online-payments";
import { createAdminClient } from "@/lib/supabase/admin";

// Paying by card in two steps, so the fee can depend on the kind of card (CLAUDE.md rule 6): Stripe's secure
// page saves the card first (no charge), Parcel Manage reads whether it's credit or debit, the tenant sees the
// exact fee (credit: the processor's cost, at most 3%; debit and prepaid: none) and confirms, and only then is
// the card charged. The fee is always worked out again on the server from the card itself.

type Card = { brand?: string; last4?: string; funding?: string };
type SetupSession = {
  id: string;
  mode: string;
  status: string;
  customer: string | null;
  metadata: Record<string, string>;
  setup_intent: { payment_method: { id: string; card?: Card } | null } | null;
};
type Intent = { id: string; status: string; amount: number; metadata: Record<string, string>; next_action?: { redirect_to_url?: { url?: string } } | null; last_payment_error?: { message?: string } | null };

export type CardChoice = { sessionId: string; amountCents: number; feeCents: number; funding: string; label: string; customer: string; paymentMethod: string };

const BRAND: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover", diners: "Diners Club", jcb: "JCB", unionpay: "UnionPay" };
const KIND: Record<string, string> = { credit: "credit card", debit: "debit card", prepaid: "prepaid card" };

/** Step 1: Stripe's page to enter the card (saved for this payment only, nothing charged yet). */
export async function startCardSetup(input: { account: string; companyId: string; leaseId: string; amountCents: number; email: string | null; productName: string; back: (path: string) => string }) {
  const customer = await stripe<{ id: string }>("POST", "customers", { email: input.email ?? undefined, "metadata[lease_id]": input.leaseId }, input.account);
  return stripe<{ url: string }>(
    "POST",
    "checkout/sessions",
    {
      mode: "setup",
      currency: "usd",
      customer: customer.id,
      "payment_method_types[0]": "card",
      "metadata[purpose]": "card_payment",
      "metadata[lease_id]": input.leaseId,
      "metadata[company_id]": input.companyId,
      "metadata[amount_cents]": input.amountCents,
      "metadata[product]": input.productName.slice(0, 200),
      success_url: input.back("/portal/pay/card?session={CHECKOUT_SESSION_ID}"),
      cancel_url: input.back("/portal/pay"),
    },
    input.account,
  );
}

/** Step 2: the saved card and its fee, only for this tenant's lease at this company. Null if it doesn't match. */
export async function readCardChoice(account: string, sessionId: string, companyId: string, leaseId: string): Promise<CardChoice | null> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  const s = await stripe<SetupSession>("GET", `checkout/sessions/${sessionId}`, { "expand[]": "setup_intent.payment_method" }, account).catch(() => null);
  const pm = s?.setup_intent?.payment_method;
  if (!s || s.mode !== "setup" || s.status !== "complete" || s.metadata.purpose !== "card_payment" || s.metadata.company_id !== companyId || s.metadata.lease_id !== leaseId || !pm || !s.customer) return null;
  const amountCents = Number(s.metadata.amount_cents);
  if (!Number.isInteger(amountCents) || amountCents < 100) return null;
  const { data: c } = await createAdminClient().from("company").select("settings").eq("id", companyId).single();
  const rent = readBusinessRules(c?.settings).rent;
  const funding = pm.card?.funding ?? "unknown";
  return {
    sessionId,
    amountCents,
    feeCents: cardFeeCents(amountCents, funding, { percent: rent.cardCostPercent, fixedCents: rent.cardCostFixedCents }),
    funding,
    label: `${BRAND[pm.card?.brand ?? ""] ?? "Card"} ${KIND[funding] ?? "card"}${pm.card?.last4 ? ` ending ${pm.card.last4}` : ""}`,
    customer: s.customer,
    paymentMethod: pm.id,
  };
}

/**
 * Step 3: charge the card for the payment plus its fee. Pressing Pay twice can't charge twice (Stripe returns
 * the first result for the same key). A bank that wants the cardholder to confirm (3-D Secure) sends them to
 * its page, then back to /portal/pay/card/done.
 */
export async function chargeCard(account: string, choice: CardChoice, companyId: string, leaseId: string, back: (path: string) => string): Promise<{ paid: true } | { redirect: string } | { error: string }> {
  const pi = await stripe<Intent>(
    "POST",
    "payment_intents",
    {
      amount: choice.amountCents + choice.feeCents,
      currency: "usd",
      customer: choice.customer,
      payment_method: choice.paymentMethod,
      "payment_method_types[0]": "card",
      confirm: true,
      return_url: back("/portal/pay/card/done"),
      description: choice.feeCents ? `Payment $${(choice.amountCents / 100).toFixed(2)} + credit card fee $${(choice.feeCents / 100).toFixed(2)}` : `Payment $${(choice.amountCents / 100).toFixed(2)}`,
      "metadata[card_payment]": "1",
      "metadata[lease_id]": leaseId,
      "metadata[company_id]": companyId,
      "metadata[amount_cents]": choice.amountCents,
      "metadata[fee_cents]": choice.feeCents,
      "metadata[funding]": choice.funding,
    },
    account,
    `card-payment-${choice.sessionId}`,
  ).catch((e: unknown) => ({ id: "", status: "failed", amount: 0, metadata: {}, last_payment_error: { message: e instanceof Error ? e.message : undefined } }) as Intent);
  return settle(pi, companyId);
}

/** After the bank's confirmation page: look the payment up again and record it if it went through. */
export async function finishCardPayment(account: string, paymentIntentId: string, companyId: string, leaseId: string) {
  if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) return { error: "That payment couldn't be found." };
  const pi = await stripe<Intent>("GET", `payment_intents/${paymentIntentId}`, {}, account).catch(() => null);
  if (!pi || pi.metadata.company_id !== companyId || pi.metadata.lease_id !== leaseId) return { error: "That payment couldn't be found." };
  return settle(pi, companyId);
}

async function settle(pi: Intent, companyId: string): Promise<{ paid: true } | { redirect: string } | { error: string }> {
  if (pi.status === "succeeded") {
    const err = await recordOnline(createAdminClient(), companyId, pi.metadata.lease_id, "card", Number(pi.metadata.amount_cents), pi.id, Number(pi.metadata.fee_cents ?? 0), "Online card payment");
    // The payment went through even if recording hiccuped; the Stripe webhook records it too.
    if (err) console.error("card payment record", pi.id, err);
    return { paid: true };
  }
  if (pi.status === "requires_action" && pi.next_action?.redirect_to_url?.url) return { redirect: pi.next_action.redirect_to_url.url };
  if (pi.status === "processing") return { paid: true };
  return { error: `The card wasn't charged${pi.last_payment_error?.message ? `: ${pi.last_payment_error.message}` : "."} Try again or use another card or your bank account.` };
}
