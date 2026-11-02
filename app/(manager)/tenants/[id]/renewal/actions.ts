"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { contactName, date, money, todayIn } from "@/lib/format";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { checkChoices, choiceSchema, describeChoice } from "@/lib/renewal-offers";
import { buildChoices, renewalContext } from "@/lib/renewal-offers-data";
import { requireCompany } from "@/lib/session";
import { companyUrl } from "@/lib/tenant";

// Renewal offers from the lease page. Sending is the person's own click (CLAUDE.md rule 4); the tenant picks an
// option in the portal; applying the choice to the lease is again a person's click.

export type OfferState = { error?: string; message?: string };
const EDIT_ROLES = ["admin", "property_manager", "leasing_agent"];

export async function sendRenewalOffer(leaseId: string, _: OfferState, form: FormData): Promise<OfferState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: "Your role can't send renewal offers." };
  const today = todayIn(company.time_zone);
  const p = z
    .object({
      increase: z.coerce.number({ message: "Enter the increase as a percent." }).min(0, "The increase can't be negative.").max(25, "That increase looks too high (25% at most)."),
      respond_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date to answer by.").refine((d) => d > today, "The answer-by date must be in the future."),
      message: z.string().trim().max(1000).default(""),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const ctx = await renewalContext(supabase, company, leaseId, today);
  if (!ctx) return { error: "Lease not found." };
  if (ctx.lease.status !== "active") return { error: "Only an active lease can be offered a renewal." };
  const choices = buildChoices([1, 2, 3].map((i) => String(form.get(`option${i}`) ?? "")), ctx, p.data.increase);
  if (typeof choices === "string") return { error: choices };
  const problem = checkChoices(choices);
  if (problem) return { error: problem };

  const tenants = ctx.lease.lease_tenant.filter((t) => t.role === "tenant" && t.contact?.email);
  if (!tenants.length) return { error: "No one on this lease has an e-mail address. Add one under People on this lease." };
  const to = tenants.map((t) => t.contact!.email!.split(/[,;]/)[0].trim());

  // A new offer replaces any earlier one still waiting.
  await supabase.from("renewal_offer").update({ status: "withdrawn" }).eq("company_id", company.id).eq("lease_id", leaseId).eq("status", "sent");
  const { data: offer, error } = await supabase
    .from("renewal_offer")
    .insert({ company_id: company.id, lease_id: leaseId, increase_percent: p.data.increase, options: choices as never, message: p.data.message || null, respond_by: p.data.respond_by, sent_to: to, created_by: user.id })
    .select("id")
    .single();
  if (error || !offer) return { error: "The offer couldn't be saved." };

  const where = `${ctx.lease.unit.property?.name ?? ""}${ctx.lease.unit.label !== "Home" ? `, ${ctx.lease.unit.label}` : ""}`;
  const content = {
    preheader: `Your renewal options, answer by ${date(p.data.respond_by)}.`,
    heading: "Your lease renewal options",
    fromLine: escapeHtml(company.name),
    paragraphs: [
      `Hello ${escapeHtml(contactName(tenants[0].contact))},`,
      `Your lease at <strong>${escapeHtml(where)}</strong> ends ${ctx.lease.end_date ? escapeHtml(date(ctx.lease.end_date)) : "soon"}. We'd like you to stay. Here are your options:`,
      choices.map((c, i) => `<strong>${i + 1}.</strong> ${escapeHtml(describeChoice(c, money, date))}`).join("<br>"),
      ...(p.data.message ? [escapeHtml(p.data.message)] : []),
      `Please choose one in your resident portal by <strong>${escapeHtml(date(p.data.respond_by))}</strong>.`,
    ],
    button: company.subdomain ? { label: "Choose my option", url: companyUrl(company.subdomain, ROOT_DOMAIN, "/portal/renewal") } : undefined,
    note: company.office_phone ? `Questions? Call ${escapeHtml(company.office_phone)}.` : undefined,
  };
  const sent = await sendEmail({ to, subject: "Your lease renewal options", html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
  revalidatePath(`/tenants/${leaseId}/renewal`);
  revalidatePath(`/tenants/${leaseId}`);
  return sent ? { message: `Offer sent to ${to.join(", ")}.` } : { message: "Offer saved, but the e-mail didn't go out. The tenant can still see it in their portal." };
}

export async function withdrawRenewalOffer(offerId: string): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return;
  const { data } = await supabase.from("renewal_offer").update({ status: "withdrawn" }).eq("id", offerId).eq("company_id", company.id).eq("status", "sent").select("lease_id").maybeSingle();
  if (data) revalidatePath(`/tenants/${data.lease_id}/renewal`);
}

/**
 * Apply the tenant's choice to the lease (a person's click). A lease option sets the new end date and the rent
 * change on the start day, and adds a to-do to send the renewal lease for signature. Month-to-month sets the
 * new rent from the start day and adds a to-do for the written notice that ends it after the last month
 * (Fla. Stat. 83.57(3)), unless they renew first. Notices are never sent automatically.
 */
export async function applyRenewalChoice(offerId: string): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return;
  const { data: offer } = await supabase.from("renewal_offer").select("id, lease_id, status, options, chosen_option").eq("id", offerId).eq("company_id", company.id).maybeSingle();
  if (!offer || offer.status !== "accepted" || offer.chosen_option == null) return;
  const choice = choiceSchema.safeParse((offer.options as unknown[])[offer.chosen_option]);
  if (!choice.success) return;
  const c = choice.data;
  const { data: lease } = await supabase.from("lease").select("id, start_date, lease_tenant(is_primary, role, contact(first_name, last_name, business_name))").eq("id", offer.lease_id).eq("company_id", company.id).single();
  if (!lease) return;
  const who = contactName([...lease.lease_tenant].filter((t) => t.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.contact);
  if (c.kind === "term") {
    await supabase.from("lease").update({ end_date: c.endDate, next_rent_increase_on: c.start, next_rent_cents: c.rentCents }).eq("id", lease.id).eq("company_id", company.id);
    await supabase.from("automation_task").upsert(
      { company_id: company.id, key: `renewal_sign:${offer.id}`, kind: "renewal_lease", lease_id: lease.id, title: `Send ${who}'s renewal lease for signature`, detail: `They chose: ${describeChoice(c, money, date)}.`, due_on: todayIn(company.time_zone), status: "open" },
      { onConflict: "company_id,key" },
    );
  } else {
    await supabase.from("lease").update({ next_rent_increase_on: c.start, next_rent_cents: c.rentCents }).eq("id", lease.id).eq("company_id", company.id);
    await supabase.from("automation_task").upsert(
      {
        company_id: company.id,
        key: `mtm_end:${offer.id}`,
        kind: "mtm_end_notice",
        lease_id: lease.id,
        title: `Month-to-month ends ${date(c.lastDay)} for ${who}: give written notice by ${date(c.noticeBy)}`,
        detail: `Month-to-month is limited to ${c.maxMonths} months. Unless they sign a renewal first, give written notice to end the tenancy on ${date(c.lastDay)}, at least 30 days before (Fla. Stat. 83.57(3)), delivered as 83.56(4) allows.`,
        letter_template: null,
        due_on: c.noticeBy,
        status: "open",
      },
      { onConflict: "company_id,key" },
    );
  }
  await supabase.from("renewal_offer").update({ status: "applied", applied_at: new Date().toISOString() }).eq("id", offer.id);
  // The "apply their choice" to-do is done now.
  await supabase.from("automation_task").update({ status: "done", done_at: new Date().toISOString() }).eq("company_id", company.id).eq("key", `renewal_answer:${offer.id}`).eq("status", "open");
  revalidatePath(`/tenants/${lease.id}/renewal`);
  revalidatePath(`/tenants/${lease.id}`);
  revalidatePath("/tasks");
}
