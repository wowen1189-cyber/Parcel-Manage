"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { inviteSummary, sendInvites } from "@/lib/portal-invites";
import { requireCompany } from "@/lib/session";
import { MAX_TEXT } from "@/lib/sms";
import { companyTextMode, receiveText, textContact } from "@/lib/sms-send";
import { companyUrl } from "@/lib/tenant";

export type PortalStaffState = { error?: string; message?: string };
const ROLES = ["admin", "property_manager", "leasing_agent", "maintenance_coordinator", "accountant"];

/** E-mail a tenant the link to their portal (and open the portal for them). They sign in with the same e-mail. */
export async function sendPortalInvite(_: PortalStaffState, form: FormData): Promise<PortalStaffState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't invite tenants." };
  const id = z.string().uuid().safeParse(form.get("contact_id"));
  if (!id.success) return { error: "Tenant not found." };
  if (!company.subdomain) return { error: "The company has no web address yet." };
  const r = await sendInvites(supabase, company, [`t:${id.data}`]);
  if (!r.sent.length && !r.skipped.length && !r.failed.length) return { error: "Only tenants on a current lease can be invited." };
  revalidatePath("/tenants", "layout");
  return inviteSummary(r);
}

/** Reply to a tenant: shows in their portal and is e-mailed to them, signed by the sender with their title. */
export async function replyToTenant(_: PortalStaffState, form: FormData): Promise<PortalStaffState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't message tenants." };
  const parsed = z.object({ contact_id: z.string().uuid(), lease_id: z.string().uuid(), body: z.string().trim().min(2, "Write your reply.").max(4000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data: c } = await supabase.from("contact").select("id, first_name, last_name, business_name, kind, email").eq("id", parsed.data.contact_id).eq("company_id", company.id).maybeSingle();
  if (!c) return { error: "Tenant not found." };
  const { data: profile } = await supabase.from("profile").select("full_name").eq("id", user.id).single();
  const senderName = profile?.full_name ?? company.name;
  const { error } = await supabase.from("message").insert({
    company_id: company.id,
    thread_key: `contact:${c.id}`,
    contact_id: c.id,
    lease_id: parsed.data.lease_id,
    channel: "portal",
    direction: "outbound",
    sender_membership_id: membership.id,
    sender_name: senderName,
    sender_title: membership.title,
    body: parsed.data.body,
    status: "sent",
  });
  if (error) return { error: error.message };
  const email = c.email?.split(/[,;]/)[0]?.trim();
  if (email && company.subdomain) {
    const content = {
      preheader: parsed.data.body.slice(0, 90),
      heading: `Message from ${company.name}`,
      paragraphs: [escapeHtml(parsed.data.body).replace(/\n/g, "<br>"), `— ${escapeHtml(senderName)}${membership.title ? `, ${escapeHtml(membership.title)}` : ""}`],
      button: { label: "Reply in my portal", url: companyUrl(company.subdomain, ROOT_DOMAIN, "/portal/messages") },
      fromLine: company.name,
    };
    await sendEmail({ to: email, subject: `Message from ${company.name}`, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
  }
  revalidatePath(`/tenants/${parsed.data.lease_id}`);
  return { message: email ? "Sent to their portal and e-mail." : "Sent to their portal." };
}

/** Text a tenant who agreed to texts. In practice mode the text is saved but not sent. */
export async function textTenant(_: PortalStaffState, form: FormData): Promise<PortalStaffState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't text tenants." };
  const parsed = z
    .object({ contact_id: z.string().uuid("Choose who to text."), lease_id: z.string().uuid(), body: z.string().trim().min(2, "Write your text.").max(MAX_TEXT, `Keep texts under ${MAX_TEXT} characters.`) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data: onLease } = await supabase.from("lease_tenant").select("contact_id").eq("lease_id", parsed.data.lease_id).eq("contact_id", parsed.data.contact_id).eq("company_id", company.id).maybeSingle();
  if (!onLease) return { error: "They aren't on this lease." };
  const { data: profile } = await supabase.from("profile").select("full_name").eq("id", user.id).single();
  const r = await textContact(supabase, company, {
    contactId: parsed.data.contact_id,
    leaseId: parsed.data.lease_id,
    body: parsed.data.body,
    sender: { membershipId: membership.id, name: profile?.full_name ?? company.name, title: membership.title },
  });
  revalidatePath(`/tenants/${parsed.data.lease_id}`);
  if (!r.ok) return { error: r.error ?? "The text didn't send." };
  return { message: r.practice ? "Saved as a practice text (not sent)." : "Text sent." };
}

/** Practice mode only: pretend the tenant texted back, to try replies, STOP and START before going live. */
export async function practiceReply(_: PortalStaffState, form: FormData): Promise<PortalStaffState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't do this." };
  if (companyTextMode(company).live) return { error: "Practice replies are off once real texts are on." };
  const parsed = z.object({ contact_id: z.string().uuid(), lease_id: z.string().uuid(), body: z.string().trim().min(1, "Write what they texted.").max(MAX_TEXT) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data: c } = await supabase.from("contact").select("mobile").eq("id", parsed.data.contact_id).eq("company_id", company.id).maybeSingle();
  if (!c?.mobile) return { error: "They have no mobile number." };
  const r = await receiveText(supabase, { ...company, office_email: null }, c.mobile, parsed.data.body, null);
  revalidatePath(`/tenants/${parsed.data.lease_id}`);
  return { message: r.keyword === "stop" ? "Practice STOP: texts are now off for them." : r.keyword === "start" ? "Practice START: texts are back on if they had agreed before." : "Practice reply saved." };
}
