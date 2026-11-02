"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { countLinked, syncFeed } from "@/lib/bank-feed-sync";
import { pairLinked } from "@/lib/bank-feeds";
import { stripeConfigured } from "@/lib/integrations/stripe/client";
import { createLinkSession, currentBalance, disconnect, getAccount, getSessionAccounts, holderFor, refreshBalance, subscribeTransactions } from "@/lib/integrations/stripe/financial-connections";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Bank feeds (lib/bank-feeds.ts): link the company's own bank accounts through Stripe's window, then sync.

export type FeedState = { error?: string; message?: string };
const ROLES = ["admin", "accountant"];
const NOT_ALLOWED = "Only an admin or accountant can connect bank feeds.";

/** Start Stripe's bank sign-in window: returns the session's client secret for Stripe.js. */
export async function startBankLink(): Promise<{ clientSecret?: string; sessionId?: string; error?: string }> {
  const { company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  if (!stripeConfigured()) return { error: "Stripe isn't set up for Parcel Manage yet." };
  try {
    const admin = createAdminClient();
    const { data: c } = await admin.from("company").select("stripe_fc_customer_id, office_email").eq("id", company.id).single();
    let holder = c?.stripe_fc_customer_id;
    if (!holder) {
      holder = await holderFor({ id: company.id, name: company.legal_name ?? company.name, office_email: c?.office_email ?? null });
      await admin.from("company").update({ stripe_fc_customer_id: holder }).eq("id", company.id);
    }
    const s = await createLinkSession(holder);
    return { clientSecret: s.client_secret, sessionId: s.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Stripe couldn't start the bank connection." };
  }
}

/** After the window closes: match the linked accounts to ours by last 4, turn on daily updates and pull them in. */
export async function finishBankLink(sessionId: string): Promise<FeedState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  if (!/^fcsess_\w+$/.test(sessionId)) return { error: "That bank connection didn't finish." };
  const admin = createAdminClient();
  const { data: c } = await admin.from("company").select("stripe_fc_customer_id").eq("id", company.id).single();
  const session = await getSessionAccounts(sessionId);
  if (!c?.stripe_fc_customer_id || session.customer !== c.stripe_fc_customer_id) return { error: "That bank connection belongs to another company." };
  if (!session.accounts.length) return { message: "No accounts were connected." };
  const { data: banks } = await supabase.from("bank_account").select("id, company_id, name, last4, fc_account_id, fc_synced_at").eq("company_id", company.id);
  const { pairs, unmatched } = pairLinked(session.accounts, banks ?? []);
  let added = 0;
  for (const { bank, fc } of pairs) {
    await supabase.from("bank_account").update({ fc_account_id: fc.id, fc_institution: fc.institution_name, fc_status: fc.status ?? "active", fc_linked_at: new Date().toISOString() }).eq("id", bank.id);
    try {
      await subscribeTransactions(fc.id);
    } catch {
      // Already subscribed, or the bank doesn't offer transactions; the sync below says which.
    }
    const r = await syncFeed(admin, { ...bank, fc_account_id: fc.id }, company.time_zone);
    added += r.added;
  }
  await countLinked(admin, company.id);
  revalidatePath("/bank-accounts");
  const parts = [
    pairs.length ? `Connected ${pairs.map((p) => `${p.bank.name} …${p.bank.last4}`).join(", ")}.` : "",
    added ? `${added} transactions brought in.` : pairs.length ? "Transactions arrive within a few minutes (Stripe is reading them now)." : "",
    unmatched.length ? `Not matched to an account here: ${unmatched.map((u) => `${u.display_name ?? u.institution_name} …${u.last4 ?? "?"}`).join(", ")}. Add them under Bank accounts (same last 4), then connect again.` : "",
  ];
  return { message: parts.filter(Boolean).join(" ") };
}

async function loadLinked(id: string) {
  const ctx = await requireCompany();
  const { data: bank } = await ctx.supabase.from("bank_account").select("id, company_id, fc_account_id, fc_synced_at").eq("id", id).eq("company_id", ctx.company.id).maybeSingle();
  return { ...ctx, bank };
}

export async function syncNow(id: string): Promise<FeedState> {
  const { company, membership, bank } = await loadLinked(id);
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  if (!bank?.fc_account_id) return { error: "This account isn't connected to a bank feed." };
  const r = await syncFeed(createAdminClient(), bank, company.time_zone);
  revalidatePath(`/bank-accounts/${id}`);
  return r.error ? { error: r.error } : { message: `${r.added} new transaction${r.added === 1 ? "" : "s"}, ${r.matched} matched to the books.` };
}

/** Ask the bank for today's balance (10¢ at Stripe each time). */
export async function pullBalance(id: string): Promise<FeedState> {
  const { supabase, company, membership, bank } = await loadLinked(id);
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  if (!bank?.fc_account_id) return { error: "This account isn't connected to a bank feed." };
  try {
    let a = await refreshBalance(bank.fc_account_id);
    await supabase.rpc("count_balance_pull", { p_company: company.id });
    for (let i = 0; i < 8 && a.balance_refresh?.status === "pending"; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      a = await getAccount(bank.fc_account_id);
    }
    const bal = currentBalance(a);
    if (a.balance_refresh?.status === "failed") return { error: "The bank didn't return a balance. Some smaller banks don't share balances; use the statement instead." };
    if (!bal) return { message: "Asked the bank; the balance will show here in a minute." };
    await supabase.from("bank_account").update({ fc_balance_cents: bal.cents, fc_balance_as_of: bal.asOf }).eq("id", bank.id);
    revalidatePath(`/bank-accounts/${id}`);
    return { message: "Balance updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't reach the bank feed." };
  }
}

export async function disconnectFeed(id: string): Promise<FeedState> {
  const { supabase, membership, bank } = await loadLinked(id);
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  if (!bank?.fc_account_id) return { error: "Not connected." };
  const fcId = z.string().parse(bank.fc_account_id);
  try {
    await disconnect(fcId);
  } catch {
    // Already disconnected at Stripe or the bank; clear it here either way.
  }
  await supabase.from("bank_account").update({ fc_account_id: null, fc_status: "disconnected" }).eq("id", bank.id);
  revalidatePath(`/bank-accounts/${id}`);
  revalidatePath("/bank-accounts");
  return { message: "Disconnected. Transactions already brought in stay." };
}
