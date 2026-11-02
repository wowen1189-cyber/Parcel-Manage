"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROOT_DOMAIN } from "@/lib/env";
import { stripe } from "@/lib/integrations/stripe/client";
import { chargeCard, readCardChoice, startCardSetup } from "@/lib/card-payment";
import { leasePaymentAccount } from "@/lib/payment-account";
import { requireTenant } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyUrl } from "@/lib/tenant";

export type PayState = { error?: string };

/** Start a payment: Stripe's secure page on the property owner's account (else the company's). A bank payment
 *  is charged there; a card is saved first so its fee (credit cards only) is shown before it's charged. */
export async function startPayment(_: PayState, form: FormData): Promise<PayState> {
  const { company, lease, me } = await requireTenant();
  const p = z
    .object({ amount: z.string().transform((v) => Math.round(Number(v.replace(/[$,\s]/g, "")) * 100)).refine((v) => v >= 100, "Enter at least $1.00."), method: z.enum(["ach", "card"]) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const db = createAdminClient();
  const { data: c } = await db.from("company").select("subdomain").eq("id", company.id).single();
  const to = await leasePaymentAccount(db, company.id, lease.id);
  if (!to.ready || !to.account || !c?.subdomain) return { error: "Online payments aren't turned on yet." };
  const { data: full } = await createAdminClient().from("lease").select("certified_funds_only").eq("id", lease.id).single();
  if (full?.certified_funds_only) return { error: "Your account requires payment by money order or cashier's check. Contact the office." };
  const back = (path: string) => companyUrl(c.subdomain!, ROOT_DOMAIN, path);
  const product = `Rent and charges: ${lease.unit.property.name}${lease.unit.label !== "Home" ? ` ${lease.unit.label}` : ""}`;
  if (p.data.method === "card") {
    const setup = await startCardSetup({ account: to.account, companyId: company.id, leaseId: lease.id, amountCents: p.data.amount, email: me.email ?? null, productName: product, back });
    redirect(setup.url);
  }
  const session = await stripe<{ url: string }>(
    "POST",
    "checkout/sessions",
    {
      mode: "payment",
      "payment_method_types[0]": "us_bank_account",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": product,
      "line_items[0][price_data][unit_amount]": p.data.amount,
      "line_items[0][quantity]": 1,
      customer_email: me.email ?? undefined,
      "payment_intent_data[metadata][lease_id]": lease.id,
      "metadata[lease_id]": lease.id,
      "metadata[company_id]": company.id,
      "metadata[amount_cents]": p.data.amount,
      "metadata[fee_cents]": 0,
      "metadata[method]": "ach",
      success_url: back("/portal/payments?paid=1"),
      cancel_url: back("/portal/pay"),
    },
    to.account,
  );
  redirect(session.url);
}

/** The tenant confirms the card payment with its fee (worked out again here from the card itself). */
export async function payWithCard(sessionId: string): Promise<PayState> {
  const { company, lease } = await requireTenant();
  const db = createAdminClient();
  const { data: c } = await db.from("company").select("subdomain").eq("id", company.id).single();
  const to = await leasePaymentAccount(db, company.id, lease.id);
  if (!to.ready || !to.account || !c?.subdomain) return { error: "Online payments aren't turned on yet." };
  const choice = await readCardChoice(to.account, sessionId, company.id, lease.id);
  if (!choice) return { error: "That card couldn't be found. Start again from Pay rent." };
  const r = await chargeCard(to.account, choice, company.id, lease.id, (path) => companyUrl(c.subdomain!, ROOT_DOMAIN, path));
  if ("error" in r) return { error: r.error };
  redirect("redirect" in r ? r.redirect : "/portal/payments?paid=1");
}

/** Autopay setup: the tenant links a bank account in Stripe's secure page; the webhook saves it. */
export async function startAutopay(_: PayState, form: FormData): Promise<PayState> {
  const { company, lease, me } = await requireTenant();
  const p = z
    .object({
      day: z.coerce.number().int().min(1).max(28),
      max: z.string().optional().transform((v) => (v ? Math.round(Number(v.replace(/[$,\s]/g, "")) * 100) : 0)),
      agree: z.literal("on", { message: "Check the box to authorize the automatic payments." }),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const db = createAdminClient();
  const { data: c } = await db.from("company").select("subdomain").eq("id", company.id).single();
  const to = await leasePaymentAccount(db, company.id, lease.id);
  if (!to.ready || !c?.subdomain) return { error: "Online payments aren't turned on yet." };
  const customer = await stripe<{ id: string }>("POST", "customers", { email: me.email ?? undefined, "metadata[lease_id]": lease.id }, to.account);
  const back = (path: string) => companyUrl(c.subdomain!, ROOT_DOMAIN, path);
  const session = await stripe<{ url: string }>(
    "POST",
    "checkout/sessions",
    {
      mode: "setup",
      currency: "usd",
      customer: customer.id,
      "payment_method_types[0]": "us_bank_account",
      "metadata[lease_id]": lease.id,
      "metadata[company_id]": company.id,
      "metadata[contact_id]": me.id,
      "metadata[day]": p.data.day,
      "metadata[max_cents]": p.data.max || "",
      success_url: back("/portal/pay?autopay=1"),
      cancel_url: back("/portal/pay"),
    },
    to.account,
  );
  redirect(session.url);
}

export async function stopAutopay(): Promise<void> {
  const { company, lease } = await requireTenant();
  await createAdminClient().from("autopay").update({ active: false }).eq("company_id", company.id).eq("lease_id", lease.id).eq("active", true);
  revalidatePath("/portal/pay");
}
