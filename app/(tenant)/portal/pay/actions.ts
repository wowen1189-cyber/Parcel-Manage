"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readBusinessRules } from "@/lib/business-rules";
import { ROOT_DOMAIN } from "@/lib/env";
import { stripe } from "@/lib/integrations/stripe/client";
import { cardFeeCents } from "@/lib/integrations/stripe/fees";
import { requireTenant } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyUrl } from "@/lib/tenant";

export type PayState = { error?: string };

/** Start a payment: Stripe's secure checkout on the company's own account. The card fee is a separate line. */
export async function startPayment(_: PayState, form: FormData): Promise<PayState> {
  const { company, lease, me } = await requireTenant();
  const p = z
    .object({ amount: z.string().transform((v) => Math.round(Number(v.replace(/[$,\s]/g, "")) * 100)).refine((v) => v >= 100, "Enter at least $1.00."), method: z.enum(["ach", "card"]) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: c } = await createAdminClient().from("company").select("subdomain, settings, stripe_account_id, stripe_charges_enabled").eq("id", company.id).single();
  if (!c?.stripe_account_id || !c.stripe_charges_enabled || !c.subdomain) return { error: "Online payments aren't turned on yet." };
  const { data: full } = await createAdminClient().from("lease").select("certified_funds_only").eq("id", lease.id).single();
  if (full?.certified_funds_only) return { error: "Your account requires payment by money order or cashier's check. Contact the office." };
  const fee = p.data.method === "card" ? cardFeeCents(p.data.amount, readBusinessRules(c.settings).rent.cardFeePercent) : 0;
  const back = (path: string) => companyUrl(c.subdomain!, ROOT_DOMAIN, path);
  const session = await stripe<{ url: string }>(
    "POST",
    "checkout/sessions",
    {
      mode: "payment",
      "payment_method_types[0]": p.data.method === "ach" ? "us_bank_account" : "card",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": `Rent and charges: ${lease.unit.property.name}${lease.unit.label !== "Home" ? ` ${lease.unit.label}` : ""}`,
      "line_items[0][price_data][unit_amount]": p.data.amount,
      "line_items[0][quantity]": 1,
      ...(fee
        ? {
            "line_items[1][price_data][currency]": "usd",
            "line_items[1][price_data][product_data][name]": "Card convenience fee",
            "line_items[1][price_data][unit_amount]": fee,
            "line_items[1][quantity]": 1,
          }
        : {}),
      customer_email: me.email ?? undefined,
      "payment_intent_data[metadata][lease_id]": lease.id,
      "metadata[lease_id]": lease.id,
      "metadata[company_id]": company.id,
      "metadata[amount_cents]": p.data.amount,
      "metadata[fee_cents]": fee,
      "metadata[method]": p.data.method,
      success_url: back("/portal/payments?paid=1"),
      cancel_url: back("/portal/pay"),
    },
    c.stripe_account_id,
  );
  redirect(session.url);
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
  const { data: c } = await createAdminClient().from("company").select("subdomain, stripe_account_id, stripe_charges_enabled").eq("id", company.id).single();
  if (!c?.stripe_account_id || !c.stripe_charges_enabled || !c.subdomain) return { error: "Online payments aren't turned on yet." };
  const customer = await stripe<{ id: string }>("POST", "customers", { email: me.email ?? undefined, "metadata[lease_id]": lease.id }, c.stripe_account_id);
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
    c.stripe_account_id,
  );
  redirect(session.url);
}

export async function stopAutopay(): Promise<void> {
  const { company, lease } = await requireTenant();
  await createAdminClient().from("autopay").update({ active: false }).eq("company_id", company.id).eq("lease_id", lease.id).eq("active", true);
  revalidatePath("/portal/pay");
}
