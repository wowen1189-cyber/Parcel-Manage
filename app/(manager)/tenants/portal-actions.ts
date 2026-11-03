"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { inviteSummary, sendInvites } from "@/lib/portal-invites";
import { requireCompany } from "@/lib/session";
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
