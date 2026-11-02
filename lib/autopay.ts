import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autopayAmount, autopayDue } from "@/lib/autopay-rules";
import { stripe } from "@/lib/integrations/stripe/client";
import { buildLedger } from "@/lib/ledger";
import type { Database } from "@/lib/supabase/database.types";

// Drafts each due autopay from the tenant's saved bank account. Bank payments take a few days to clear;
// the payment is recorded when Stripe confirms it (payment_intent.succeeded in the webhook), not here.
export async function runAutopay(db: SupabaseClient<Database>, companyId: string, today: string) {
  const { data: company } = await db.from("company").select("stripe_account_id").eq("id", companyId).single();
  const { data: rows } = await db.from("autopay").select("id, lease_id, stripe_account_id, stripe_customer_id, stripe_payment_method_id, day_of_month, max_cents, last_run_month").eq("company_id", companyId).eq("active", true);
  let drafted = 0;
  for (const a of rows ?? []) {
    if (!autopayDue(today, a.day_of_month, a.last_run_month)) continue;
    const [{ data: charges }, { data: payments }, { data: lease }] = await Promise.all([
      db.from("charge").select("id, charge_type, description, amount_cents, due_date, created_at").eq("lease_id", a.lease_id),
      db.from("payment").select("id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at").eq("lease_id", a.lease_id),
      db.from("lease").select("status, certified_funds_only, opening_balance_cents, opening_balance_as_of").eq("id", a.lease_id).single(),
    ]);
    // The saved bank lives on the account it was set up on (older setups: the company's).
    const account = a.stripe_account_id ?? company?.stripe_account_id ?? null;
    let result: string;
    if (!account) {
      result = "Skipped: online payments aren't connected";
    } else if (!lease || !["active", "notice"].includes(lease.status) || lease.certified_funds_only) {
      result = "Skipped: lease isn't active or needs certified funds";
    } else {
      const { balanceCents } = buildLedger(charges ?? [], payments ?? [], { cents: lease.opening_balance_cents, asOf: lease.opening_balance_as_of });
      const amount = autopayAmount(balanceCents, a.max_cents);
      if (!amount) result = "Nothing due";
      else if (a.max_cents && balanceCents > a.max_cents) result = await draft(a, amount, companyId, account, `Drafted the limit; ${(balanceCents - amount) / 100} still due`);
      else result = await draft(a, amount, companyId, account, "Drafted");
      if (result.startsWith("Drafted")) drafted++;
    }
    await db.from("autopay").update({ last_run_month: today.slice(0, 7), last_result: `${today}: ${result}` }).eq("id", a.id);
  }
  return drafted;
}

async function draft(a: { id: string; lease_id: string; stripe_customer_id: string; stripe_payment_method_id: string }, amount: number, companyId: string, account: string, ok: string) {
  try {
    await stripe(
      "POST",
      "payment_intents",
      {
        amount,
        currency: "usd",
        customer: a.stripe_customer_id,
        payment_method: a.stripe_payment_method_id,
        "payment_method_types[0]": "us_bank_account",
        confirm: true,
        off_session: true,
        "metadata[autopay]": a.id,
        "metadata[lease_id]": a.lease_id,
        "metadata[company_id]": companyId,
        "metadata[amount_cents]": amount,
        "metadata[method]": "ach",
      },
      account,
    );
    return `${ok} $${(amount / 100).toFixed(2)}`;
  } catch (e) {
    return `Failed: ${e instanceof Error ? e.message : "Stripe error"}`;
  }
}
