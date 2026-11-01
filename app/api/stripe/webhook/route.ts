import { NextResponse, type NextRequest } from "next/server";
import { emailHtml, emailText } from "@/lib/email/layout";
import { sendEmail } from "@/lib/integrations/resend/send";
import { verifyStripeWebhook } from "@/lib/integrations/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe Connect webhook: records tenant payments once they've cleared, and reverses a payment that comes
// back (a dispute or returned bank payment). Each event is handled once (stripe_event table).

type Session = { id: string; payment_status: string; payment_intent: string | null; metadata: Record<string, string> };
type Dispute = { payment_intent: string | null; amount: number };

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyStripeWebhook(raw, request.headers.get("stripe-signature"))) return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  const event = JSON.parse(raw) as { id: string; type: string; account?: string; data: { object: unknown } };
  const db = createAdminClient();
  const { data: company } = event.account ? await db.from("company").select("id, name, office_email, settings").eq("stripe_account_id", event.account).maybeSingle() : { data: null };
  const { error: dup } = await db.from("stripe_event").insert({ id: event.id, company_id: company?.id ?? null, type: event.type });
  if (dup) return NextResponse.json({ received: true, duplicate: true });
  if (!company) return NextResponse.json({ received: true });

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Session;
    if (s.payment_status !== "paid" || !s.metadata?.lease_id || s.metadata.company_id !== company.id) return NextResponse.json({ received: true });
    const ref = s.payment_intent ?? s.id;
    const { data: existing } = await db.from("payment").select("id").eq("company_id", company.id).eq("processor_ref", ref).maybeSingle();
    if (!existing) {
      const { data: paymentId, error } = await db.rpc("record_payment", {
        p_lease: s.metadata.lease_id,
        p_method: s.metadata.method === "card" ? "card" : "ach",
        p_amount: Number(s.metadata.amount_cents),
        p_received: new Date().toISOString().slice(0, 10),
        p_reference: `Online ${s.metadata.method === "card" ? "card" : "bank"} payment`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await db.from("payment").update({ processor_ref: ref, fee_cents: Number(s.metadata.fee_cents ?? 0) }).eq("id", paymentId as string);
    }
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
