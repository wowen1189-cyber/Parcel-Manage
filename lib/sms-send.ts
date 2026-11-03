import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { contactName } from "@/lib/format";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { sendTwilioSms, twilioConfigured } from "@/lib/integrations/twilio/client";
import { keyword, outboundText, prettyPhone, textMode, toE164 } from "@/lib/sms";
import type { Database } from "@/lib/supabase/database.types";
import { companyUrl } from "@/lib/tenant";

// Sending and receiving texts (migration 0061). Every text is saved as a message (channel "sms"). In practice
// mode it is saved with status "simulated" and never leaves Parcel Manage. Texts go only to people who agreed
// themselves (CLAUDE.md rule 6); STOP from their phone turns texts off, START turns them back on.

type Db = SupabaseClient<Database>;
export type TextCompany = { id: string; name: string; subdomain: string | null; office_email: string | null; sms_from_number: string | null; sms_alert_number: string | null; sms_live: boolean };
export type TextResult = { ok: boolean; practice: boolean; error?: string };

const statusCallback = () => (ROOT_DOMAIN.startsWith("localhost") ? undefined : `https://${ROOT_DOMAIN}/api/sms/status`);

export function companyTextMode(company: Pick<TextCompany, "sms_from_number" | "sms_live">) {
  return textMode(company, twilioConfigured());
}

async function deliver(db: Db, company: TextCompany, to: string, text: string, row: Omit<Database["public"]["Tables"]["message"]["Insert"], "body" | "channel" | "direction">): Promise<TextResult> {
  const mode = companyTextMode(company);
  const { data: saved, error } = await db
    .from("message")
    .insert({ ...row, channel: "sms", direction: "outbound", body: text, status: mode.live ? "queued" : "simulated" })
    .select("id")
    .single();
  if (error) return { ok: false, practice: !mode.live, error: error.message };
  if (!mode.live) return { ok: true, practice: true };
  const r = await sendTwilioSms({ from: company.sms_from_number!, to, body: text, statusCallback: statusCallback() });
  await db
    .from("message")
    .update("sid" in r ? { status: "sent", provider_ref: r.sid } : { status: "failed" })
    .eq("id", saved.id);
  return "sid" in r ? { ok: true, practice: false } : { ok: false, practice: false, error: r.error };
}

/** Texts a tenant, owner or vendor who agreed to texts. */
export async function textContact(
  db: Db,
  company: TextCompany,
  input: { contactId: string; body: string; leaseId?: string | null; workOrderId?: string | null; sender?: { membershipId: string; name: string; title: string | null } },
): Promise<TextResult> {
  const { data: c } = await db.from("contact").select("id, mobile, sms_opt_in").eq("id", input.contactId).eq("company_id", company.id).maybeSingle();
  if (!c) return { ok: false, practice: false, error: "Person not found." };
  if (!c.sms_opt_in) return { ok: false, practice: false, error: "They haven't agreed to texts." };
  const to = toE164(c.mobile);
  if (!to) return { ok: false, practice: false, error: "Their mobile number isn't a US mobile number." };
  const { count } = await db.from("message").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("contact_id", c.id).eq("channel", "sms").eq("direction", "outbound").neq("status", "failed");
  const text = outboundText(company.name, input.body, !count);
  return deliver(db, company, to, text, {
    company_id: company.id,
    thread_key: `contact:${c.id}`,
    contact_id: c.id,
    lease_id: input.leaseId ?? null,
    work_order_id: input.workOrderId ?? null,
    sender_membership_id: input.sender?.membershipId ?? null,
    sender_name: input.sender?.name ?? company.name,
    sender_title: input.sender?.title ?? null,
  });
}

/** Texts the company's emergency alert number (its own staff, set by an admin in Settings › Texting). */
export async function textAlert(db: Db, company: TextCompany, body: string, workOrderId?: string): Promise<TextResult> {
  const to = toE164(company.sms_alert_number);
  if (!to) return { ok: false, practice: false, error: "No emergency alert number is set." };
  return deliver(db, company, to, outboundText(company.name, body, false), { company_id: company.id, thread_key: "alert", contact_id: null, work_order_id: workOrderId ?? null, sender_name: "Parcel Manage" });
}

/**
 * An incoming text (from Twilio, or the practice "pretend they replied" button). STOP and START change the
 * person's text setting; anything else is saved on their thread and the office is e-mailed.
 */
export async function receiveText(db: Db, company: TextCompany, from: string, body: string, providerRef: string | null): Promise<{ contactId: string | null; leaseId: string | null; keyword: ReturnType<typeof keyword> }> {
  const digits = (toE164(from) ?? from).replace(/\D/g, "").slice(-10);
  const { data: people } = await db
    .from("contact")
    .select("id, kind, first_name, last_name, business_name, sms_opt_in, sms_opt_in_at, lease_tenant(role, lease(id, status))")
    .eq("company_id", company.id)
    .eq("mobile_digits", digits);
  const list = people ?? [];
  const current = (p: (typeof list)[number]) => p.lease_tenant.find((lt) => ["active", "notice", "pending_signature"].includes(lt.lease?.status ?? ""))?.lease?.id ?? null;
  const who = list.find((p) => current(p)) ?? list[0] ?? null;
  const leaseId = who ? current(who) : null;
  const kw = keyword(body);
  const now = new Date().toISOString();

  if (kw === "stop" && list.length) {
    await db.from("contact").update({ sms_opt_in: false, sms_opt_out_at: now }).eq("company_id", company.id).in("id", list.map((p) => p.id));
  }
  // START only restores texts for people who agreed in writing before; it never opts in someone new.
  const before = list.filter((p) => p.sms_opt_in_at);
  if (kw === "start" && before.length) {
    await db.from("contact").update({ sms_opt_in: true, sms_opt_out_at: null }).eq("company_id", company.id).in("id", before.map((p) => p.id));
  }

  await db.from("message").insert({
    company_id: company.id,
    thread_key: who ? `contact:${who.id}` : `sms:+1${digits}`,
    contact_id: who?.id ?? null,
    lease_id: leaseId,
    channel: "sms",
    direction: "inbound",
    sender_name: who ? contactName(who) : prettyPhone(from),
    body: body.slice(0, 2000),
    status: "received",
    provider_ref: providerRef,
  });

  if (!kw && company.office_email && company.subdomain) {
    const name = who ? contactName(who) : prettyPhone(from);
    const path = leaseId ? `/tenants/${leaseId}` : "/communications";
    const content = {
      preheader: body.slice(0, 90),
      heading: `New text from ${escapeHtml(name)}`,
      paragraphs: [escapeHtml(body).replace(/\n/g, "<br>"), who ? "" : "This number isn't on anyone's record yet."].filter(Boolean),
      button: { label: "Open in Parcel Manage", url: companyUrl(company.subdomain, ROOT_DOMAIN, path) },
      fromLine: company.name,
    };
    await sendEmail({ to: company.office_email, subject: `New text from ${name}`, html: emailHtml(content), text: emailText(content), fromName: "Parcel Manage" });
  }
  return { contactId: who?.id ?? null, leaseId, keyword: kw };
}
