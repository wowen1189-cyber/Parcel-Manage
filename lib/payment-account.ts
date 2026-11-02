import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { pickPaymentAccount } from "./payment-account-rules";

// Which Stripe connected account a lease's online payments go to: the property owner's own account when
// the owner has one, else the company's (migration 0037).

export async function leasePaymentAccount(db: SupabaseClient<Database>, companyId: string, leaseId: string) {
  const [{ data: company }, { data: lease }] = await Promise.all([
    db.from("company").select("stripe_account_id, stripe_charges_enabled").eq("id", companyId).single(),
    db.from("lease").select("unit(property(entity(id, name, stripe_account_id, stripe_charges_enabled)))").eq("id", leaseId).eq("company_id", companyId).maybeSingle(),
  ]);
  return pickPaymentAccount(company, lease?.unit?.property?.entity ?? null);
}

/** The company an event from a connected account belongs to: its own account or one of its owners'. */
export async function companyForAccount(db: SupabaseClient<Database>, account: string) {
  const { data: company } = await db.from("company").select("id, name, office_email, settings").eq("stripe_account_id", account).maybeSingle();
  if (company) return company;
  const { data: owner } = await db.from("entity").select("company(id, name, office_email, settings)").eq("stripe_account_id", account).maybeSingle();
  return owner?.company ?? null;
}
