import { NextResponse, type NextRequest } from "next/server";
import { emailHtml, emailText } from "@/lib/email/layout";
import { sendEmail } from "@/lib/integrations/resend/send";
import { stripe, verifyStripeWebhook } from "@/lib/integrations/stripe/client";
import { recordOnline } from "@/lib/online-payments";
import { companyForAccount } from "@/lib/payment-account";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe Connect webhook: records tenant payments once they've cleared, and reverses a payment that comes
// back (a dispute or returned bank payment). Each event is handled once (stripe_event table).

type Session = { id: string; mode?: string; payment_status: string; payment_intent: string | null; setup_intent?: string | null; customer?: string | null; metadata: Record<string, string> };
type Intent = { id: string; amount: number; metadata: Record<string, string>; last_payment_error?: { message?: string } | null };
type Dispute = { payment_intent: string | null; amount: number };

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyStripeWebhook(raw, request.headers.get("stripe-signature"))) return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  const event = JSON.parse(raw) as { id: string; type: string; account?: string; data: { object: unknown } };
  const db = createAdminClient();
  // Events come from the company's own account or one of its owners' accounts.
  const company = event.account ? await companyForAccount(db, event.account) : null;
  const { error: dup } = await db.from("stripe_event").insert({ id: event.id, company_id: company?.id ?? null, type: event.type });
  if (dup) return NextResponse.json({ received: true, duplicate: true });
  if (!company) return NextResponse.json({ received: true });

  if (event.type === "checkout.session.completed" && (event.data.object as Session).mode === "setup" && (event.data.object as Session).metadata?.purpose === "card_payment") {
    // A card saved for a one-time payment (lib/card-payment.ts): nothing to do until the tenant confirms it.
  } else if (event.type === "checkout.session.completed" && (event.data.object as Session).mode === "setup") {
    // Autopay setup finished: save the bank account, replacing any earlier one on this lease.
    const s = event.data.object as Session;
    if (s.metadata?.company_id !== company.id || !s.metadata.lease_id || !s.setup_intent || !s.customer) return NextResponse.json({ received: true });
    const si = await stripe<{ payment_method: { id: string; us_bank_account?: { bank_name?: string; last4?: string } } }>("GET", `setup_intents/${s.setup_intent}`, { "expand[]": "payment_method" }, event.account);
    const bank = si.payment_method.us_bank_account;
    await db.from("autopay").update({ active: false }).eq("company_id", company.id).eq("lease_id", s.metadata.lease_id).eq("active", true);
    await db.from("autopay").insert({
      company_id: company.id,
      lease_id: s.metadata.lease_id,
      contact_id: s.metadata.contact_id || null,
      stripe_account_id: event.account ?? null,
      stripe_customer_id: s.customer,
      stripe_payment_method_id: si.payment_method.id,
      bank_label: bank ? `${bank.bank_name ?? "Bank"} ending ${bank.last4 ?? ""}`.trim() : "Bank account",
      day_of_month: Math.min(28, Math.max(1, Number(s.metadata.day) || 1)),
      max_cents: Number(s.metadata.max_cents) || null,
    });
  } else if (event.type === "checkout.session.completed" && (event.data.object as Session).metadata?.application_id) {
    // Application fees paid (card). The main applicant's payment is the one the admin fee is refunded from.
    const s = event.data.object as Session & { amount_total?: number };
    if (s.metadata.company_id !== company.id || s.payment_status !== "paid") return NextResponse.json({ received: true });
    const { data: a } = await db.from("application").select("id, fees_paid_cents, payment_ref").eq("id", s.metadata.application_id).eq("company_id", company.id).maybeSingle();
    if (a) await db.from("application").update({ fees_paid_cents: a.fees_paid_cents + (s.amount_total ?? 0), payment_ref: s.metadata.role === "applicant" ? s.payment_intent : a.payment_ref }).eq("id", a.id);
  } else if (event.type === "payment_intent.succeeded" && (event.data.object as Intent).metadata?.autopay) {
    const pi = event.data.object as Intent;
    if (pi.metadata.company_id !== company.id) return NextResponse.json({ received: true });
    const err = await recordOnline(db, company.id, pi.metadata.lease_id, "ach", pi.amount, pi.id, 0, "Autopay");
    if (err) return NextResponse.json({ error: err }, { status: 500 });
  } else if (event.type === "payment_intent.succeeded" && (event.data.object as Intent).metadata?.card_payment) {
    // A confirmed card payment; usually already recorded when the tenant paid. Recording is once per reference.
    const pi = event.data.object as Intent;
    if (pi.metadata.company_id !== company.id) return NextResponse.json({ received: true });
    const err = await recordOnline(db, company.id, pi.metadata.lease_id, "card", Number(pi.metadata.amount_cents), pi.id, Number(pi.metadata.fee_cents ?? 0), "Online card payment");
    if (err) return NextResponse.json({ error: err }, { status: 500 });
  } else if (event.type === "payment_intent.payment_failed" && (event.data.object as Intent).metadata?.autopay) {
    const pi = event.data.object as Intent;
    const { data: a } = await db.from("autopay").select("id, lease_id").eq("id", pi.metadata.autopay).eq("company_id", company.id).maybeSingle();
    if (a) {
      await db.from("autopay").update({ last_result: `${new Date().toISOString().slice(0, 10)}: Failed: ${pi.last_payment_error?.message ?? "the bank declined it"}` }).eq("id", a.id);
      const { data: people } = await db.from("lease_tenant").select("role, contact(email)").eq("lease_id", a.lease_id);
      const to = (people ?? []).filter((p) => p.role === "tenant" && p.contact?.email).map((p) => p.contact!.email!);
      const content = { preheader: "Your autopay didn't go through.", heading: "Autopay didn't go through", paragraphs: [`Your automatic payment of $${(pi.amount / 100).toFixed(2)} didn't go through: ${pi.last_payment_error?.message ?? "the bank declined it"}.`, "Your rent is still due. Please pay in your resident portal or contact the office."], fromLine: company.name };
      if (to.length) await sendEmail({ to, subject: "Autopay didn't go through", html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
      if (company.office_email) await sendEmail({ to: company.office_email, subject: "A tenant's autopay failed", html: emailHtml({ ...content, heading: "A tenant's autopay failed" }), text: emailText(content), fromName: "Parcel Manage" });
    }
  } else if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Session;
    if (s.payment_status !== "paid" || !s.metadata?.lease_id || s.metadata.company_id !== company.id) return NextResponse.json({ received: true });
    const err = await recordOnline(db, company.id, s.metadata.lease_id, s.metadata.method === "card" ? "card" : "ach", Number(s.metadata.amount_cents), s.payment_intent ?? s.id, Number(s.metadata.fee_cents ?? 0), `Online ${s.metadata.method === "card" ? "card" : "bank"} payment`);
    if (err) return NextResponse.json({ error: err }, { status: 500 });
  } else if (event.type === "charge.dispute.created") {
    const d = event.data.object as Dispute;
    const { data: pay } = d.payment_intent ? await db.from("payment").select("id, status, lease_id").eq("company_id", company.id).eq("processor_ref", d.payment_intent).maybeSingle() : { data: null };
    if (pay?.status === "succeeded") {
      await db.rpc("return_payment", { p_payment: pay.id, p_date: new Date().toISOString().slice(0, 10), p_fee: 0 });
      if (company.office_email) {
        const content = { preheader: "An online payment was disputed.", heading: "Online payment disputed", paragraphs: ["A tenant's online payment was disputed or returned. It has been reversed on their ledger. Respond to the dispute in Stripe."], fromLine: company.name };
        await sendEmail({ to: company.office_email, subject: "Online payment disputed", html: emailHtml(content), text: emailText(content), fromName: "Parcel Manage" });
      }
    }
  }
  return NextResponse.json({ received: true });
}
