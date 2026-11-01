import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHtml, emailText, type EmailContent } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { contactName, todayIn } from "@/lib/format";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import type { Database } from "@/lib/supabase/database.types";
import { companyUrl } from "@/lib/tenant";
import { canPay, itemsNeeded, newToken, REQUEST_ITEM, requiredItems, type RequestItem } from "@/lib/vendor-requests";

// Sends (or re-sends) a vendor's paperwork request. Used by the office's "Request paperwork" button and by
// the daily reminder job. Each send gets a fresh private link; older links stop working.

type Db = SupabaseClient<Database>;
export type RequestCompany = { id: string; name: string; legal_name: string | null; subdomain: string | null; office_email: string | null; office_phone: string | null; time_zone: string };

export type SendResult = { ok: true; sentTo: string; items: RequestItem[] } | { ok: false; reason: string };

export async function sendVendorRequest(db: Db, company: RequestCompany, vendorId: string, opts: { reminder: boolean; createdBy?: string | null }): Promise<SendResult> {
  const { data: v } = await db
    .from("vendor")
    .select("id, trade, w9_on_file, coi_expires_on, workers_comp_expires_on, dispatch_override, is_1099, contact(kind, first_name, last_name, business_name, email)")
    .eq("id", vendorId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!v) return { ok: false, reason: "Vendor not found." };
  const email = v.contact.email?.split(/[,;]/)[0]?.trim();
  if (!email) return { ok: false, reason: "Add the vendor's email first." };
  if (!company.subdomain) return { ok: false, reason: "The company has no web address yet." };
  const items = itemsNeeded(v, todayIn(company.time_zone));
  if (!requiredItems(items).length) return { ok: false, reason: "Nothing is missing: their W-9 and insurance are on file." };

  const { token, hash } = newToken();
  const { data: open } = await db.from("vendor_request").select("id, send_count").eq("company_id", company.id).eq("vendor_id", v.id).is("completed_at", null).is("cancelled_at", null).maybeSingle();
  const saved = open
    ? await db.from("vendor_request").update({ token_hash: hash, items, sent_to: email, send_count: open.send_count + 1, last_sent_at: new Date().toISOString() }).eq("id", open.id)
    : await db.from("vendor_request").insert({ company_id: company.id, vendor_id: v.id, token_hash: hash, items, sent_to: email, created_by: opts.createdBy ?? null });
  if (saved.error) return { ok: false, reason: saved.error.message };

  const link = companyUrl(company.subdomain, ROOT_DOMAIN, `/vendor/setup/${token}`);
  const name = contactName(v.contact);
  const blockedPay = !canPay(v);
  const list = `<ul style="margin:0 0 16px;padding-left:20px;">${items.map((i) => `<li style="margin:0 0 6px;"><strong>${REQUEST_ITEM[i].label}</strong>${REQUEST_ITEM[i].optional ? " (if you have employees, or your exemption)" : ""}</li>`).join("")}</ul>`;
  const content: EmailContent = {
    preheader: opts.reminder ? `You're not set up with ${company.name} yet.` : `${company.name} needs a few documents before sending you work.`,
    heading: opts.reminder ? "Reminder: you're not set up yet" : "Please send your W-9 and insurance",
    paragraphs: [
      `Hi ${escapeHtml(name)},`,
      opts.reminder
        ? `We still need the documents below. <strong>Until we have them, you're not set up as a ${escapeHtml(company.name)} vendor: we can't send you work orders${blockedPay ? " or pay your invoices" : ""}.</strong>`
        : `${escapeHtml(company.name)} needs these on file before we can send you work orders or pay your invoices:`,
      list,
      `Upload them from your phone or computer. It takes about two minutes and you don't need an account. Make <strong>${escapeHtml(company.legal_name ?? company.name)}</strong> the certificate holder on your insurance certificate.`,
    ],
    button: { label: "Upload my documents", url: link },
    note: "This link is just for you. If it stops working, use the newest e-mail from us.",
    fromLine: company.name,
    footer: [company.name, company.office_phone].filter(Boolean).join(" · "),
  };
  const sent = await sendEmail({
    to: email,
    subject: opts.reminder ? `Reminder: ${company.name} still needs your W-9 and insurance` : `${company.name}: please send your W-9 and insurance`,
    html: emailHtml(content),
    text: emailText(content),
    fromName: company.name,
    replyTo: company.office_email,
  });
  if (!sent) return { ok: false, reason: "The e-mail couldn't be sent. Check the e-mail address and try again." };
  return { ok: true, sentTo: email, items };
}
