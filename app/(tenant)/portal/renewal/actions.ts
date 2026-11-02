"use server";

import { revalidatePath } from "next/cache";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { contactName, date, money, todayIn } from "@/lib/format";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { requireTenant } from "@/lib/portal";
import { choiceSchema, describeChoice } from "@/lib/renewal-offers";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyUrl } from "@/lib/tenant";

// The tenant answers a renewal offer on their own lease. Their answer is recorded and the office is told and
// gets a to-do; the lease itself only changes when a person applies the choice (CLAUDE.md rule 4).

export type AnswerState = { error?: string; message?: string };

export async function answerRenewalOffer(offerId: string, choice: number | "decline"): Promise<AnswerState> {
  const { company, lease, me } = await requireTenant();
  const db = createAdminClient();
  const { data: offer } = await db.from("renewal_offer").select("id, lease_id, status, options, respond_by").eq("id", offerId).eq("company_id", company.id).maybeSingle();
  if (!offer || offer.lease_id !== lease.id) return { error: "That offer couldn't be found." };
  if (offer.status !== "sent") return { error: "This offer has already been answered or replaced." };
  if (offer.respond_by < todayIn(company.time_zone)) return { error: `This offer closed on ${date(offer.respond_by)}. Please contact the office.` };
  const options = offer.options as unknown[];
  const picked = choice === "decline" ? null : choiceSchema.safeParse(options[choice]);
  if (choice !== "decline" && !picked?.success) return { error: "Choose one of the options." };

  await db
    .from("renewal_offer")
    .update({ status: choice === "decline" ? "declined" : "accepted", chosen_option: choice === "decline" ? null : choice, responded_at: new Date().toISOString(), responded_by: me.id })
    .eq("id", offer.id)
    .eq("status", "sent");
  const who = contactName(me);
  const where = `${lease.unit.property.name}${lease.unit.label !== "Home" ? ` ${lease.unit.label}` : ""}`;
  const what = picked?.success ? describeChoice(picked.data, money, date) : null;
  await db.from("automation_task").upsert(
    {
      company_id: company.id,
      key: `renewal_answer:${offer.id}`,
      kind: what ? "renewal_accepted" : "renewal_declined",
      lease_id: lease.id,
      title: what ? `${who} chose a renewal option: apply it to the lease` : `${who} won't renew at ${where}`,
      detail: what ? `${what}. Open the lease's renewal offer and apply it.` : "Plan the move-out: the move-out inspection and the deposit deadlines (Fla. Stat. 83.49) start when they leave.",
      due_on: todayIn(company.time_zone),
      status: "open",
    },
    { onConflict: "company_id,key" },
  );
  const { data: c } = await db.from("company").select("subdomain").eq("id", company.id).single();
  if (company.office_email && c?.subdomain) {
    const content = {
      preheader: what ? "A tenant chose a renewal option." : "A tenant declined their renewal.",
      heading: what ? `${who} chose a renewal option` : `${who} won't renew`,
      paragraphs: [what ? `${escapeHtml(who)} (${escapeHtml(where)}) chose: <strong>${escapeHtml(what)}</strong>. Nothing has changed on the lease yet: apply their choice from the renewal offer.` : `${escapeHtml(who)} (${escapeHtml(where)}) declined the renewal offer.`],
      button: { label: "Open the renewal offer", url: companyUrl(c.subdomain, ROOT_DOMAIN, `/tenants/${lease.id}/renewal`) },
      fromLine: company.name,
    };
    await sendEmail({ to: company.office_email, subject: what ? `${who} chose a renewal option` : `${who} won't renew`, html: emailHtml(content), text: emailText(content), fromName: "Parcel Manage" });
  }
  revalidatePath("/portal/renewal");
  revalidatePath("/portal");
  return { message: !what ? "Thanks for letting us know. We'll be in touch about your move-out." : picked?.success && picked.data.kind === "mtm" ? "Thank you! We'll confirm your month-to-month terms." : "Thank you! We'll send your renewal lease to sign." };
}
