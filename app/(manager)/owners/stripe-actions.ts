"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROOT_DOMAIN } from "@/lib/env";
import { stripe, stripeConfigured } from "@/lib/integrations/stripe/client";
import { isAdmin, requireCompany } from "@/lib/session";
import { companyUrl } from "@/lib/tenant";

// An owner's own Stripe account (Connect Express), so rent for the owner's properties is paid straight into
// the owner's bank. The owner, or the admin with the owner's details, finishes Stripe's sign-up.

/** Start or continue Stripe sign-up for this owner. */
export async function connectOwnerStripe(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  const id = z.string().uuid().safeParse(form.get("entity_id"));
  if (!isAdmin(membership) || !company.subdomain || !id.success || !stripeConfigured()) return;
  const { data: owner } = await supabase.from("entity").select("id, name, email, entity_type, stripe_account_id").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!owner) return;
  let account = owner.stripe_account_id;
  if (!account) {
    const created = await stripe<{ id: string }>("POST", "accounts", {
      type: "express",
      country: "US",
      email: owner.email?.split(/[,;]/)[0].trim() || undefined,
      business_type: owner.entity_type === "Individual" ? "individual" : "company",
      "business_profile[name]": owner.name,
      "business_profile[product_description]": `Residential and commercial rent collected by ${company.name}`,
      "capabilities[card_payments][requested]": true,
      "capabilities[transfers][requested]": true,
      "capabilities[us_bank_account_ach_payments][requested]": true,
      "metadata[company_id]": company.id,
      "metadata[entity_id]": owner.id,
    });
    account = created.id;
    await supabase.from("entity").update({ stripe_account_id: account }).eq("id", owner.id);
  }
  const back = companyUrl(company.subdomain, ROOT_DOMAIN, `/owners/${owner.id}?stripe=1`);
  const link = await stripe<{ url: string }>("POST", "account_links", { account, refresh_url: back, return_url: back, type: "account_onboarding" });
  redirect(link.url);
}

/** Ask Stripe whether the owner's account can take payments yet. */
export async function refreshOwnerStripe(entityId: string): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return;
  const { data: owner } = await supabase.from("entity").select("id, stripe_account_id").eq("id", entityId).eq("company_id", company.id).maybeSingle();
  if (!owner?.stripe_account_id) return;
  const acct = await stripe<{ charges_enabled: boolean }>("GET", `accounts/${owner.stripe_account_id}`);
  await supabase.from("entity").update({ stripe_charges_enabled: acct.charges_enabled }).eq("id", owner.id);
  revalidatePath(`/owners/${owner.id}`);
}
