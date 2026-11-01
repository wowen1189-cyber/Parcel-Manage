"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ROOT_DOMAIN } from "@/lib/env";
import { stripe } from "@/lib/integrations/stripe/client";
import { isAdmin, requireCompany } from "@/lib/session";
import { companyUrl } from "@/lib/tenant";

/** Start or continue Stripe onboarding for the company's own account (Connect Express). */
export async function connectStripe(): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership) || !company.subdomain) return;
  let account = company.stripe_account_id;
  if (!account) {
    const created = await stripe<{ id: string }>("POST", "accounts", {
      type: "express",
      country: "US",
      email: company.office_email ?? undefined,
      "business_profile[name]": company.legal_name ?? company.name,
      "capabilities[card_payments][requested]": true,
      "capabilities[transfers][requested]": true,
      "capabilities[us_bank_account_ach_payments][requested]": true,
      "metadata[company_id]": company.id,
    });
    account = created.id;
    await supabase.from("company").update({ stripe_account_id: account }).eq("id", company.id);
  }
  const back = companyUrl(company.subdomain, ROOT_DOMAIN, "/settings/payments?return=1");
  const link = await stripe<{ url: string }>("POST", "account_links", { account, refresh_url: back, return_url: back, type: "account_onboarding" });
  redirect(link.url);
}

/** Check with Stripe whether the account can take payments yet. */
export async function refreshStripe(): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership) || !company.stripe_account_id) return;
  const acct = await stripe<{ charges_enabled: boolean }>("GET", `accounts/${company.stripe_account_id}`);
  await supabase.from("company").update({ stripe_charges_enabled: acct.charges_enabled }).eq("id", company.id);
  revalidatePath("/settings/payments");
}
