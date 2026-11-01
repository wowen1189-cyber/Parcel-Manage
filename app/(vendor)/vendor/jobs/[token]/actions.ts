"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readBusinessRules } from "@/lib/business-rules";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { contactName } from "@/lib/format";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadJob } from "@/lib/vendor-jobs";
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

/** Upload step 1 for photos and the invoice: a one-time URL into this job's folder. */
export async function startJobUpload(input: { token: string; kind: "photo" | "invoice"; type: string; size: number }): Promise<{ path?: string; uploadToken?: string; error?: string }> {
  const found = await loadJob(input.token);
  if (!found) return { error: DEAD };
  const allowed = input.kind === "invoice" ? ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"] : ["image/jpeg", "image/png", "image/heic", "image/webp"];
  if (!allowed.includes(input.type)) return { error: input.kind === "invoice" ? "Upload the invoice as a PDF or photo." : "Add photos (JPG, PNG or HEIC)." };
  if (input.size > 15 * 1024 * 1024) return { error: "That file is too big (15 MB max)." };
  const ext = input.type === "application/pdf" ? "pdf" : input.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${found.wo.company_id}/work-orders/${found.wo.id}/vendor-${input.kind}-${Date.now()}.${ext}`;
  const { data, error } = await found.db.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start." };
  return { path, uploadToken: data.token };
}

/** Done: what was done, photos, and the invoice (becomes a bill the office approves before paying). */
export async function finishJob(_: JobState, form: FormData): Promise<JobState> {
  const token = String(form.get("token"));
  const found = await loadJob(token);
  if (!found) return { error: DEAD };
  const { db, wo } = found;
  const p = z
    .object({
      resolution: z.string().trim().min(3, "Say what you did.").max(2000),
      amount: z.string().trim().transform((v) => v.replace(/[$,\s]/g, "")).refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), "Enter the invoice total as a dollar amount."),
      invoice_number: z.string().trim().max(60).optional(),
      invoice_path: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const folder = `${wo.company_id}/work-orders/${wo.id}/vendor-`;
  const photos = form.getAll("photo_path").map(String).filter((x) => x.startsWith(`${folder}photo-`));
  const invoicePath = p.data.invoice_path && p.data.invoice_path.startsWith(`${folder}invoice-`) ? p.data.invoice_path : null;
  const amount = p.data.amount ? Math.round(Number(p.data.amount) * 100) : null;
  if (invoicePath && !amount) return { error: "Enter the invoice total.", values: typed(form) };

  for (const path of photos) await db.from("document").insert({ company_id: wo.company_id, work_order_id: wo.id, property_id: wo.property_id, storage_path: path, file_name: "Photo from vendor", category: "photo", source: "vendor portal" });
  let billNote = "";
  if (amount) {
    const { data: doc } = invoicePath
      ? await db.from("document").insert({ company_id: wo.company_id, work_order_id: wo.id, property_id: wo.property_id, vendor_id: wo.vendor_id, storage_path: invoicePath, file_name: `Invoice${p.data.invoice_number ? ` ${p.data.invoice_number}` : ""}`, category: "invoice", source: "vendor portal" }).select("id").single()
      : { data: null };
    const { data: bill } = await db
      .from("bill")
      .insert({
        company_id: wo.company_id,
        entity_id: wo.property.entity_id,
        vendor_id: wo.vendor_id,
        property_id: wo.property_id,
        unit_id: wo.unit_id,
        work_order_id: wo.id,
        invoice_number: p.data.invoice_number || null,
        invoice_date: new Date().toISOString().slice(0, 10),
        amount_cents: amount,
        memo: `Work order #${wo.number}: ${wo.title}`,
        status: "received",
        source: "vendor portal",
        document_id: doc?.id ?? null,
      })
      .select("id")
      .single();
    if (doc && bill) await db.from("document").update({ bill_id: bill.id }).eq("id", doc.id);
    billNote = ` Invoice for $${(amount / 100).toFixed(2)} is waiting for approval.`;
  }
  await db.from("work_order").update({ status: "completed", completed_at: new Date().toISOString(), vendor_completed_at: new Date().toISOString(), resolution: p.data.resolution, cost_cents: amount }).eq("id", wo.id);
  await event(db, wo, "completed", { by: "vendor", resolution: p.data.resolution, cost_cents: amount });
  await tellOffice(wo, `#${wo.number} done: ${wo.title}`, `${escapeHtml(vendorName(wo))} marked <strong>${escapeHtml(wo.title)}</strong> done: ${escapeHtml(p.data.resolution)}.${billNote}`);
  revalidatePath(`/vendor/jobs/${token}`);
  return { message: `Thanks! Marked done.${amount ? " Your invoice was sent to the office for approval." : ""}` };
}
