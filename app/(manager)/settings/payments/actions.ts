"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ROOT_DOMAIN } from "@/lib/env";
import { canTakePayments, createConnectedAccount, onboardingLink } from "@/lib/integrations/stripe/accounts";
import { isAdmin, requireCompany } from "@/lib/session";
import { companyUrl } from "@/lib/tenant";

/** Start or continue Stripe onboarding for the company's own account (lib/integrations/stripe/accounts.ts). */
export async function connectStripe(): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership) || !company.subdomain) return;
  const back = companyUrl(company.subdomain, ROOT_DOMAIN, "/settings/payments?return=1");
  let url: string;
  try {
    let account = company.stripe_account_id;
    if (!account) {
      account = await createConnectedAccount({ name: company.legal_name ?? company.name, email: company.office_email, individual: false, metadata: { company_id: company.id } });
      await supabase.from("company").update({ stripe_account_id: account }).eq("id", company.id);
    }
    url = await onboardingLink(account, back);
  } catch (e) {
    console.error("connect stripe", e);
    redirect(`/settings/payments?error=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 300) : "Stripe didn't respond.")}`);
  }
  redirect(url);
}

/** Check with Stripe whether the account can take payments yet. */
export async function refreshStripe(): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership) || !company.stripe_account_id) return;
  await supabase.from("company").update({ stripe_charges_enabled: await canTakePayments(company.stripe_account_id) }).eq("id", company.id);
  revalidatePath("/settings/payments");
}
