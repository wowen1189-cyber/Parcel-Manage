"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROOT_DOMAIN } from "@/lib/env";
import { canTakePayments, createConnectedAccount, onboardingLink } from "@/lib/integrations/stripe/accounts";
import { stripeConfigured } from "@/lib/integrations/stripe/client";
import { isAdmin, requireCompany } from "@/lib/session";
import { companyUrl } from "@/lib/tenant";

// An owner's own Stripe account (lib/integrations/stripe/accounts.ts), so rent for the owner's properties is paid straight into
// the owner's bank. The owner, or the admin with the owner's details, finishes Stripe's sign-up.

/** Start or continue Stripe sign-up for this owner. */
export async function connectOwnerStripe(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  const id = z.string().uuid().safeParse(form.get("entity_id"));
  if (!isAdmin(membership) || !company.subdomain || !id.success || !stripeConfigured()) return;
  const { data: owner } = await supabase.from("entity").select("id, name, email, entity_type, stripe_account_id").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!owner) return;
  const back = companyUrl(company.subdomain, ROOT_DOMAIN, `/owners/${owner.id}?stripe=1`);
  let url: string;
  try {
    let account = owner.stripe_account_id;
    if (!account) {
      account = await createConnectedAccount({ name: owner.name, email: owner.email?.split(/[,;]/)[0].trim() || null, individual: owner.entity_type === "Individual", metadata: { company_id: company.id, entity_id: owner.id } });
      await supabase.from("entity").update({ stripe_account_id: account }).eq("id", owner.id);
    }
    url = await onboardingLink(account, back);
  } catch (e) {
    console.error("connect owner stripe", e);
    redirect(`/owners/${owner.id}?stripe_error=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 300) : "Stripe didn't respond.")}`);
  }
  redirect(url);
}

/** Ask Stripe whether the owner's account can take payments yet. */
export async function refreshOwnerStripe(entityId: string): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return;
  const { data: owner } = await supabase.from("entity").select("id, stripe_account_id").eq("id", entityId).eq("company_id", company.id).maybeSingle();
  if (!owner?.stripe_account_id) return;
  await supabase.from("entity").update({ stripe_charges_enabled: await canTakePayments(owner.stripe_account_id) }).eq("id", owner.id);
  revalidatePath(`/owners/${owner.id}`);
}
