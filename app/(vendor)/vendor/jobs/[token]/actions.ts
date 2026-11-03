"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readBusinessRules } from "@/lib/business-rules";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { contactName, todayIn } from "@/lib/format";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { readJobInvoice, saveFinish, writeUpJob } from "@/lib/job-finish";
import { finishSchema, jobPhotoPaths } from "@/lib/job-finish-rules";
import { signedJobUpload, type InvoiceReadResult, type UploadKind, type UploadStart, type WriteUpResult } from "@/lib/job-upload";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadJob } from "@/lib/vendor-jobs";
import { toE164 } from "@/lib/sms";
import { companyUrl } from "@/lib/tenant";
import { checkEntryWindow, formatWhen, zonedToDate } from "@/lib/work-orders";

// The vendor's job link: the token is the only credential, so every lookup is by its hash and scoped to
// that one work order and its company (service role, CLAUDE.md rule 1). Scheduling enforces Florida's
// repair-entry rule (83.53(2)) and notifies the tenant; the invoice becomes a bill awaiting approval.

export type JobState = { error?: string; message?: string; values?: Record<string, string> };
const DEAD = "This link no longer works. The job may have been reassigned; call the office.";
const typed = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

async function event(db: ReturnType<typeof createAdminClient>, wo: { id: string; company_id: string }, kind: string, detail: Record<string, unknown>) {
  await db.from("work_order_event").insert({ company_id: wo.company_id, work_order_id: wo.id, kind, detail: detail as never });
}

async function tellOffice(job: NonNullable<Awaited<ReturnType<typeof loadJob>>>["wo"], subject: string, line: string) {
  if (!job.company.office_email || !job.company.subdomain) return;
  const content = { preheader: subject, heading: subject, paragraphs: [line], button: { label: "Open the work order", url: companyUrl(job.company.subdomain, ROOT_DOMAIN, `/maintenance/${job.id}`) }, fromLine: job.company.name };
  await sendEmail({ to: job.company.office_email, subject, html: emailHtml(content), text: emailText(content), fromName: "Parcel Manage" });
}

const vendorName = (job: NonNullable<Awaited<ReturnType<typeof loadJob>>>["wo"]) => (job.vendor ? contactName(job.vendor.contact) : "The vendor");

export async function acceptJob(_: JobState, form: FormData): Promise<JobState> {
  const found = await loadJob(String(form.get("token")));
  if (!found) return { error: DEAD };
  const { db, wo } = found;
  await db.from("work_order").update({ vendor_accepted_at: new Date().toISOString() }).eq("id", wo.id);
  await event(db, wo, "accepted", { vendor: vendorName(wo) });
  await tellOffice(wo, `${vendorName(wo)} accepted work order #${wo.number}`, `${escapeHtml(vendorName(wo))} accepted <strong>${escapeHtml(wo.title)}</strong>.`);
  revalidatePath(`/vendor/jobs/${form.get("token")}`);
  return { message: "Accepted. Now pick a time." };
}

export async function declineJob(_: JobState, form: FormData): Promise<JobState> {
  const found = await loadJob(String(form.get("token")));
  if (!found) return { error: DEAD };
  const { db, wo } = found;
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500) || null;
  await db.from("work_order").update({ vendor_declined_at: new Date().toISOString(), vendor_decline_reason: reason, status: "new", vendor_token_hash: null }).eq("id", wo.id);
  await event(db, wo, "declined", { vendor: vendorName(wo), reason });
  await tellOffice(wo, `${vendorName(wo)} declined work order #${wo.number}`, `${escapeHtml(vendorName(wo))} can't take <strong>${escapeHtml(wo.title)}</strong>${reason ? `: ${escapeHtml(reason)}` : ""}. Assign another vendor.`);
  return { message: "Thanks for letting us know. The office will find someone else." };
}

/** The vendor picks the visit time. Notice to the tenant goes out now, so the visit must be 24+ hours away (83.53(2)). */
export async function scheduleJob(_: JobState, form: FormData): Promise<JobState> {
  const found = await loadJob(String(form.get("token")));
  if (!found) return { error: DEAD };
  const { db, wo } = found;
  const p = z
    .object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose the start time."), hours: z.coerce.number().min(0.5).max(10) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const tz = wo.company.time_zone;
  const start = zonedToDate(p.data.start, tz);
  const end = new Date(start.getTime() + p.data.hours * 3_600_000);
  const lease = wo.unit?.lease.find((l) => l.status === "active" || l.status === "notice");
  const basis = wo.priority === "emergency" ? "emergency" : !lease || wo.unit?.status === "vacant" ? "vacant" : "notice";
  const now = new Date();
  const check = checkEntryWindow({ start, end, basis, noticeGivenAt: basis === "notice" ? now : null, timeZone: tz, rules: readBusinessRules(wo.company.settings) });
  if (!check.ok) return { error: check.reason, values: typed(form) };
  if (start < now) return { error: "Pick a time in the future.", values: typed(form) };

  const tenants = (lease?.lease_tenant ?? []).filter((t) => t.role === "tenant" && t.contact.email);
  // E-mail is the legal entry notice only when the tenant signed the 83.505 e-mail addendum; otherwise the
  // office is told to post or hand-deliver notice.
  const emailIsNotice = basis === "notice" && Boolean(lease?.email_notices_agreed) && tenants.length > 0;
  await db
    .from("work_order")
    .update({
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      status: "scheduled",
      vendor_accepted_at: wo.vendor_accepted_at ?? now.toISOString(),
      entry_basis: basis,
      entry_notice_method: emailIsNotice ? "email_addendum" : null,
      entry_notice_at: basis === "notice" && emailIsNotice ? now.toISOString() : null,
    })
    .eq("id", wo.id);
  await event(db, wo, "scheduled", { start: start.toISOString(), end: end.toISOString(), by: "vendor", entry_basis: basis });

  if (tenants.length && basis !== "vacant") {
    const where = `${wo.property.name}${wo.unit && wo.unit.label !== "Home" ? `, Unit ${wo.unit.label}` : ""}`;
    const content = {
      preheader: `Repair visit ${formatWhen(start.toISOString(), tz)}.`,
      heading: "Repair visit scheduled",
      fromLine: escapeHtml(wo.company.name),
      paragraphs: [
        "Hello,",
        `${escapeHtml(vendorName(wo))} is scheduled at <strong>${escapeHtml(where)}</strong> for: ${escapeHtml(wo.title)}.`,
        `<strong>${escapeHtml(formatWhen(start.toISOString(), tz))} to ${escapeHtml(end.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }))}</strong>`,
        basis === "notice" ? "This is your notice of entry for repairs under section 83.53, Florida Statutes. You don't need to be home. If the time doesn't work, call or reply and we'll find another." : "If the time doesn't work, call or reply.",
      ],
      note: wo.company.office_phone ? `Questions? Call ${escapeHtml(wo.company.office_phone)}.` : undefined,
    };
    const to = tenants.map((t) => t.contact.email!);
    const sent = await sendEmail({ to, subject: `Repair visit ${formatWhen(start.toISOString(), tz)}`, html: emailHtml(content), text: emailText(content), fromName: wo.company.name, replyTo: wo.company.office_email });
    await event(db, wo, "tenant_notified", { to, sent, legal_notice: emailIsNotice });
  }
  await tellOffice(
    wo,
    `#${wo.number} scheduled by ${vendorName(wo)}: ${formatWhen(start.toISOString(), tz)}`,
    `${escapeHtml(vendorName(wo))} scheduled <strong>${escapeHtml(wo.title)}</strong> for ${escapeHtml(formatWhen(start.toISOString(), tz))}.${basis === "notice" && !emailIsNotice ? " <strong>The tenant hasn't signed the e-mail notice addendum: post or hand-deliver the 24-hour entry notice now and record it on the work order.</strong>" : ""}`,
  );
  revalidatePath(`/vendor/jobs/${form.get("token")}`);
  return { message: `Scheduled for ${formatWhen(start.toISOString(), tz)}. The tenant has been notified.` };
}

/** "I'm here": the tech checks in on site (the emergency response-time metric uses it). */
export async function checkIn(token: string): Promise<JobState> {
  const found = await loadJob(token);
  if (!found) return { error: DEAD };
  const { db, wo } = found;
  if (!wo.tech_arrived_at) {
    await db.from("work_order").update({ tech_arrived_at: new Date().toISOString() }).eq("id", wo.id);
    await event(db, wo, "arrived", { by: vendorName(wo) });
  }
  revalidatePath(`/vendor/jobs/${token}`);
  return { message: "Checked in." };
}

/** Upload step 1 for photos and the invoice: a one-time URL into this job's folder. */
export async function startJobUpload(token: string, input: { kind: UploadKind; type: string; size: number }): Promise<UploadStart> {
  const found = await loadJob(token);
  if (!found) return { error: DEAD };
  return signedJobUpload(found.db, found.wo, "vendor", input);
}

/** The AI's write-up of the tech's notes and photos, for them to check and edit. */
export async function jobWriteUp(token: string, input: { notes: string; parts: string; before: string[]; after: string[] }): Promise<WriteUpResult> {
  const found = await loadJob(token);
  if (!found) return { ok: false, reason: DEAD };
  const { wo } = found;
  const photos = [...jobPhotoPaths(input.before, wo.company_id, wo.id, "vendor", "before").map((path) => ({ path, stage: "before" as const })), ...jobPhotoPaths(input.after, wo.company_id, wo.id, "vendor", "after").map((path) => ({ path, stage: "after" as const }))];
  return writeUpJob(wo, { notes: String(input.notes).slice(0, 3000), parts: String(input.parts).slice(0, 400), photos });
}

export async function jobReadInvoice(token: string, path: string): Promise<InvoiceReadResult> {
  const found = await loadJob(token);
  if (!found) return { amount: null, number: null, note: DEAD };
  if (!path.startsWith(`${found.wo.company_id}/work-orders/${found.wo.id}/vendor-invoice-`)) return { amount: null, number: null };
  return readJobInvoice(found.wo, path);
}

/** Done: photos, what was done, and the invoice (becomes a bill the office approves before paying). */
export async function finishJob(token: string, _: JobState, form: FormData): Promise<JobState> {
  const found = await loadJob(token);
  if (!found) return { error: DEAD };
  const { db, wo } = found;
  if (wo.completed_at) return { message: "This job is already marked done." };
  const p = finishSchema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const invoice = String(form.get("invoice_path") ?? "");
  const invoicePath = invoice.startsWith(`${wo.company_id}/work-orders/${wo.id}/vendor-invoice-`) ? invoice : null;
  if (invoicePath && !p.data.amount) return { error: "Enter the invoice total.", values: typed(form) };
  const before = jobPhotoPaths(form.getAll("before_path").map(String), wo.company_id, wo.id, "vendor", "before");
  const after = jobPhotoPaths(form.getAll("after_path").map(String), wo.company_id, wo.id, "vendor", "after");
  const r = await saveFinish(db, wo, p.data, { before, after, invoicePath }, { kind: "vendor" }, todayIn(wo.company.time_zone));
  const flags = [r.followUp && `<strong>Needs another visit:</strong> ${escapeHtml(r.followUp)}`, r.damage && `<strong>May be tenant damage:</strong> ${escapeHtml(r.damage)} (added to your to-do list; nothing is charged)`].filter(Boolean).join("<br>");
  await tellOffice(
    wo,
    `#${wo.number} done: ${wo.title}`,
    `${escapeHtml(vendorName(wo))} marked <strong>${escapeHtml(wo.title)}</strong> done with ${before.length + after.length} photo${before.length + after.length === 1 ? "" : "s"}: ${escapeHtml(p.data.resolution)}${p.data.amount ? `<br>Invoice for $${(p.data.amount / 100).toFixed(2)} is waiting for approval.` : ""}${flags ? `<br><br>${flags}` : ""}`,
  );
  revalidatePath(`/vendor/jobs/${token}`);
  return { message: `Thanks! Marked done.${p.data.amount ? " Your invoice was sent to the office for approval." : ""}` };
}

/** The vendor turns job texts on (only they can agree, with their mobile number) or off. */
export async function setVendorTexts(_: JobState, form: FormData): Promise<JobState> {
  const found = await loadJob(String(form.get("token")));
  if (!found?.wo.vendor) return { error: DEAD };
  const { db, wo } = found;
  const contactId = wo.vendor!.contact.id;
  const now = new Date().toISOString();
  if (form.get("texts") !== "on") {
    await db.from("contact").update({ sms_opt_in: false, sms_opt_out_at: now }).eq("id", contactId).eq("company_id", wo.company_id);
    revalidatePath(`/vendor/jobs/${form.get("token")}`);
    return { message: "Job texts are off." };
  }
  const mobile = String(form.get("mobile") ?? "").trim();
  if (!toE164(mobile)) return { error: "Enter your 10-digit mobile number.", values: { mobile } };
  if (form.get("agree") !== "on") return { error: "Check the box to agree to texts.", values: { mobile } };
  await db.from("contact").update({ mobile, sms_opt_in: true, sms_opt_in_at: now, sms_opt_out_at: null }).eq("id", contactId).eq("company_id", wo.company_id);
  await event(db, wo, "note", { note: `${vendorName(wo)} turned on job texts.` });
  revalidatePath(`/vendor/jobs/${form.get("token")}`);
  return { message: "Job texts are on. Reply STOP to any text to turn them off." };
}
