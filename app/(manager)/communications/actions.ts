"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { letterContext } from "@/lib/letter-context";
import { letterById } from "@/lib/letters";
import { letterPdf } from "@/lib/letter-pdf";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyUrl } from "@/lib/tenant";

export type LetterState = { error?: string; values?: Record<string, string> };
const ROLES = ["admin", "property_manager", "leasing_agent", "accountant", "maintenance_coordinator"];
const typed = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

/**
 * Send (or record) a letter. The text is rebuilt on the server from the template, never taken from the
 * browser. Legal notices: a person sends each one; e-mail counts as delivery only when the tenant signed the
 * 83.505 e-mail addendum (83.56(4)); otherwise they're printed and posted, handed over or mailed.
 * Every letter is filed as a document on the lease and logged.
 */
export async function sendLetter(_: LetterState, form: FormData): Promise<LetterState> {
  const { supabase, company, membership, user } = await requireCompany();
  const values = typed(form);
  if (!ROLES.includes(membership.role)) return { error: "Your role can't send letters.", values };
  const p = z
    .object({
      lease_id: z.string().uuid("Choose the tenant."),
      template_id: z.string(),
      sender_title: z.string().trim().max(80),
      delivery: z.enum(["email", "portal", "posted", "hand_delivered", "mail", "certified_mail", "print"]),
    })
    .safeParse(values);
  if (!p.success) return { error: p.error.issues[0].message, values };
  const template = letterById(p.data.template_id);
  if (!template) return { error: "Choose a letter.", values };
  const { data: profile } = await supabase.from("profile").select("full_name").eq("id", user.id).single();
  const found = await letterContext(supabase, company, p.data.lease_id, { name: profile?.full_name ?? company.name, title: p.data.sender_title });
  if (!found) return { error: "Lease not found.", values };
  const inputs: Record<string, string> = {};
  for (const i of template.inputs) {
    inputs[i.id] = String(form.get(`in_${i.id}`) ?? "").trim();
    if (!inputs[i.id] && template.legal) return { error: `Fill in "${i.label}".`, values };
  }
  if (template.legal && p.data.delivery === "email" && !found.emailNotices) {
    return { error: "This tenant hasn't signed the e-mail notice addendum, so e-mail isn't legal delivery (83.56(4)). Print it and post it, hand it over or mail it.", values };
  }
  if (template.legal && p.data.delivery === "portal") return { error: "A portal message isn't legal delivery for a Florida notice. Print it and post it, hand it over or mail it.", values };
  const recipients = found.tenants.map((t) => t.email?.split(/[,;]/)[0]?.trim()).filter((e): e is string => Boolean(e));
  if (p.data.delivery === "email" && !recipients.length) return { error: "No tenant e-mail on file. Choose another way to deliver it.", values };

  const subject = template.subject(found.ctx, inputs);
  const paragraphs = template.body(found.ctx, inputs);
  const text = paragraphs.join("\n\n");

  // File a PDF copy on the lease (private storage).
  const admin = createAdminClient();
  const path = `${company.id}/letters/${randomUUID()}.pdf`;
  const pdf = await letterPdf({ letterhead: [found.ctx.companyName, found.ctx.companyAddress, found.ctx.companyPhone], date: found.ctx.today, title: subject, cite: template.cite, paragraphs });
  const upload = await admin.storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
  if (upload.error) return { error: "The filed copy couldn't be saved. Please try again.", values };
  const { data: doc } = await admin.from("document").insert({ company_id: company.id, lease_id: p.data.lease_id, contact_id: found.tenants[0]?.id ?? null, storage_path: path, file_name: `${subject} (${found.ctx.today}).pdf`, category: template.legal ? "notice" : "other", source: "communications", uploaded_by: user.id }).select("id").single();

  const channel = p.data.delivery === "email" ? "email" : p.data.delivery === "portal" ? "portal" : "letter";
  const { data: msg, error } = await supabase
    .from("message")
    .insert({
      company_id: company.id,
      thread_key: `contact:${found.tenants[0]?.id}`,
      contact_id: found.tenants[0]?.id ?? null,
      lease_id: p.data.lease_id,
      channel,
      direction: "outbound",
      sender_membership_id: membership.id,
      sender_name: found.ctx.senderName,
      sender_title: p.data.sender_title || null,
      subject,
      body: text,
      template_id: template.id,
      delivery: p.data.delivery,
      legal: Boolean(template.legal),
      document_id: doc?.id ?? null,
      status: "sent",
    })
    .select("id")
    .single();
  if (error) return { error: error.message, values };

  if (p.data.delivery === "email") {
    const content = {
      preheader: subject,
      heading: subject,
      paragraphs: paragraphs.map((x) => escapeHtml(x)),
      ...(company.subdomain ? { button: { label: "Open my tenant portal", url: companyUrl(company.subdomain, ROOT_DOMAIN, "/portal/messages") } } : {}),
      fromLine: company.name,
      footer: [company.name, company.office_phone].filter(Boolean).join(" · "),
    };
    const ok = await sendEmail({ to: recipients, subject, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
    if (!ok) await supabase.from("message").update({ status: "failed" }).eq("id", msg.id);
  }
  revalidatePath("/communications");
  revalidatePath(`/tenants/${p.data.lease_id}`);
  redirect(`/communications/${msg.id}?sent=1`);
}
