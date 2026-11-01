"use server";

import { after } from "next/server";
import { improveTechnicianSummary } from "@/lib/ai/technician";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readBusinessRules } from "@/lib/business-rules";
import { emailHtml, emailText } from "@/lib/email/layout";
import { contactName, oneLineAddress } from "@/lib/format";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { ROOT_DOMAIN } from "@/lib/env";
import { companyUrl } from "@/lib/tenant";
import { newToken } from "@/lib/vendor-requests";
import { requireCompany } from "@/lib/session";
import { findSymptom, PRIORITY_DB, SAFETY_OPTIONS, technicianSummary, triagePriority } from "@/lib/triage";
import { vendorCompliance } from "@/lib/vendors";
import { checkEntryWindow, formatWhen, WO_PRIORITY, zonedToDate } from "@/lib/work-orders";

export type FormState = { error?: string; message?: string; values?: Record<string, string> };

const EDIT_ROLES = ["admin", "property_manager", "maintenance_coordinator"];
const NOT_ALLOWED = "Your role can't change work orders.";

function typed(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

type Ctx = Awaited<ReturnType<typeof requireCompany>>;

async function logEvent(ctx: Ctx, workOrderId: string, kind: string, detail: Record<string, unknown> = {}) {
  await ctx.supabase.from("work_order_event").insert({ company_id: ctx.company.id, work_order_id: workOrderId, kind, detail: detail as never, actor_profile_id: ctx.user.id });
}

// ---------- create ----------

export async function createWorkOrder(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  const { supabase, company, membership } = ctx;
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = z
    .object({
      property_id: z.string().uuid("Choose the property."),
      unit_id: z.string(),
      source: z.enum(["phone", "email", "staff", "portal", "inspection"]),
      safety: z.enum(["", "gas", "fire"]),
      category: z.string(),
      item: z.string(),
      symptom: z.string(),
      title: text(140),
      room: text(60),
      entry_ok: z.enum(["", "yes", "no"]),
      pets: z.enum(["", "yes", "no"]),
      tenant_note: text(2000),
      reported_by: z.string(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const d = parsed.data;

  const answers: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("q_") && String(v)) answers[k.slice(2)] = String(v);

  // Priority is computed here from the answers, never taken from the form.
  let priority: "routine" | "urgent" | "emergency";
  let title: string;
  let summary: string;
  if (d.safety) {
    const s = SAFETY_OPTIONS.find((o) => o.id === d.safety)!;
    priority = "emergency";
    title = d.safety === "gas" ? "Gas smell reported" : "Smoke, fire or sparks reported";
    summary = `Priority: Emergency (safety report: ${s.label}). ${d.tenant_note ?? ""}`.trim();
  } else {
    const found = findSymptom(d.category, d.item, d.symptom);
    if (!found) return { error: "Choose what the problem is.", values: typed(form) };
    const p = triagePriority(found.symptom, answers);
    priority = PRIORITY_DB[p.priority];
    title = d.title ?? `${found.item.label}: ${found.symptom.label}`;
    summary = technicianSummary({
      priority: p.priority,
      item: found.item.label,
      symptom: found.symptom,
      answers,
      room: d.room,
      entryOk: d.entry_ok ? d.entry_ok === "yes" : null,
      pets: d.pets ? d.pets === "yes" : null,
      note: d.tenant_note,
    });
  }

  const { data: unit } = d.unit_id ? await supabase.from("unit").select("id, property_id").eq("id", d.unit_id).eq("company_id", company.id).maybeSingle() : { data: null };
  if (d.unit_id && (!unit || unit.property_id !== d.property_id)) return { error: "That unit isn't at this property.", values: typed(form) };

  const { data: wo, error } = await supabase
    .from("work_order")
    .insert({
      company_id: company.id,
      property_id: d.property_id,
      unit_id: unit?.id ?? null,
      source: d.source,
      title,
      triage_category: d.safety ? "safety" : d.category,
      triage_item: d.safety ? d.safety : d.item,
      triage_symptom: d.safety ? d.safety : d.symptom,
      triage_answers: answers,
      priority,
      room: d.room,
      entry_ok: d.entry_ok ? d.entry_ok === "yes" : null,
      pets_in_home: d.pets ? d.pets === "yes" : null,
      tenant_note: d.tenant_note,
      ai_summary: summary,
      reported_by_contact_id: z.string().uuid().safeParse(d.reported_by).success ? d.reported_by : null,
      entry_basis: priority === "emergency" ? "emergency" : null,
    })
    .select("id, number")
    .single();
  if (error) return { error: error.message, values: typed(form) };
  after(() => improveTechnicianSummary(company.id, wo.id));
  await logEvent(ctx, wo.id, "created", { source: d.source, priority });
  revalidatePath("/maintenance");
  redirect(`/maintenance/${wo.id}?added=1`);
}

// ---------- vendor ----------

async function loadWorkOrder(ctx: Ctx, id: string) {
  const { data } = await ctx.supabase
    .from("work_order")
    .select("*, property(name, address_line1, address_line2, city, state, postal_code), unit(label, lease(status, lease_tenant(role, contact(first_name, last_name, business_name, email, mobile, phone))))")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  return data;
}

export async function assignVendor(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  const { supabase, company, membership } = ctx;
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const p = z.object({ work_order_id: z.string().uuid(), vendor_id: z.string().uuid("Choose a vendor."), email_vendor: z.literal("on").optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const wo = await loadWorkOrder(ctx, p.data.work_order_id);
  if (!wo) return { error: "Work order not found." };
  const { data: vendor } = await supabase.from("vendor").select("*, contact(*)").eq("id", p.data.vendor_id).eq("company_id", company.id).maybeSingle();
  if (!vendor) return { error: "Vendor not found." };

  // Dispatch block: on-site vendors need a W-9 and current insurance (docs/02 business rules).
  const today = new Date().toISOString().slice(0, 10);
  const compliance = vendorCompliance(vendor, today);
  if (!compliance.canDispatch) return { error: `${contactName(vendor.contact)} can't be sent work orders yet: ${compliance.issues.join(", ")}. Add their paperwork on the vendor page, or ask an admin to allow it.` };

  // The vendor's private job link (accept, schedule, finish, invoice). A new link replaces any earlier one.
  const link = newToken();
  const jobUrl = company.subdomain ? companyUrl(company.subdomain, ROOT_DOMAIN, `/vendor/jobs/${link.token}`) : null;
  const { error } = await supabase
    .from("work_order")
    .update({ vendor_id: vendor.id, status: wo.status === "scheduled" ? "scheduled" : "assigned", vendor_token_hash: link.hash, vendor_accepted_at: null, vendor_declined_at: null, vendor_decline_reason: null })
    .eq("id", wo.id)
    .eq("company_id", company.id);
  if (error) return { error: error.message };
  await logEvent(ctx, wo.id, "assigned", { vendor: contactName(vendor.contact), vendor_id: vendor.id });

  let note = "";
  if (p.data.email_vendor) {
    if (!vendor.contact.email) note = " They have no email on file, so call or text them.";
    else {
      const sent = await emailVendor(ctx, wo, vendor.contact.email, contactName(vendor.contact), jobUrl);
      await logEvent(ctx, wo.id, "notified", { to: vendor.contact.email, channel: "email", sent });
      if (sent) await supabase.from("work_order").update({ vendor_notified_at: new Date().toISOString() }).eq("id", wo.id);
      note = sent ? ` Emailed to ${vendor.contact.email}.` : " The email didn't send; call or text them.";
    }
  }
  revalidatePath(`/maintenance/${wo.id}`);
  revalidatePath("/maintenance");
  return { message: `Assigned to ${contactName(vendor.contact)}.${note}` };
}

async function emailVendor(ctx: Ctx, wo: NonNullable<Awaited<ReturnType<typeof loadWorkOrder>>>, to: string, vendorName: string, jobUrl: string | null) {
  const { company } = ctx;
  const where = [wo.property.name, wo.unit?.label && wo.unit.label !== "Home" ? `Unit ${wo.unit.label}` : null].filter(Boolean).join(", ");
  const address = oneLineAddress(wo.property);
  const priority = WO_PRIORITY[wo.priority]?.label ?? wo.priority;
  const content = {
    preheader: `${priority} work order #${wo.number} at ${where}.`,
    heading: `${priority} work order #${wo.number}`,
    fromLine: escapeHtml(company.name),
    paragraphs: [
      `Hi ${escapeHtml(vendorName)},`,
      `${escapeHtml(company.name)} has a ${priority.toLowerCase()} job for you at <strong>${escapeHtml(where)}</strong>, ${escapeHtml(address)}.`,
      `<strong>${escapeHtml(wo.title)}</strong><br>${escapeHtml(wo.ai_summary ?? "")}`,
      wo.priority === "emergency"
        ? "This is an emergency. Please call the office right away to confirm you're on the way."
        : jobUrl
          ? "Use the button to accept the job and pick a time. Florida law requires 24 hours' notice to the tenant before a repair visit (7:30 a.m. to 8:00 p.m.); we'll notify the tenant when you schedule."
          : "Please reply with the day and time you can go. Florida law requires 24 hours' notice to the tenant before a repair visit (7:30 a.m. to 8:00 p.m.), so the office will confirm the time with them.",
    ],
    ...(jobUrl ? { button: { label: "Accept and schedule", url: jobUrl } } : {}),
    note: company.office_phone ? `Office: ${escapeHtml(company.office_phone)}. Reply to this email to answer.` : "Reply to this email to answer.",
    footer: [escapeHtml(company.name), company.office_phone && escapeHtml(company.office_phone)].filter(Boolean).join(" · "),
  };
  return sendEmail({ to, subject: `${priority} work order #${wo.number}: ${wo.title} (${where})`, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
}

// ---------- schedule ----------

export async function scheduleVisit(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  const { supabase, company, membership } = ctx;
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const p = z
    .object({
      work_order_id: z.string().uuid(),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose when the visit starts."),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose when the visit ends."),
      entry_basis: z.enum(["notice", "tenant_agreed", "emergency", "vacant"]),
      notice_method: z.enum(["", "posted", "hand_delivered", "email_addendum", "mail"]),
      notice_at: z.string(),
      email_tenants: z.literal("on").optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const d = p.data;
  const wo = await loadWorkOrder(ctx, d.work_order_id);
  if (!wo) return { error: "Work order not found." };
  if (d.entry_basis === "emergency" && wo.priority !== "emergency") return { error: "Only an emergency work order can skip the entry notice. Change the priority first if this is an emergency.", values: typed(form) };
  if (d.entry_basis === "notice" && !d.notice_method) return { error: "Choose how the 24-hour notice was given.", values: typed(form) };

  const tz = company.time_zone;
  const start = zonedToDate(d.start, tz);
  const end = zonedToDate(d.end, tz);
  const noticeAt = d.entry_basis === "notice" ? (d.notice_at ? zonedToDate(d.notice_at, tz) : new Date()) : null;
  const check = checkEntryWindow({ start, end, basis: d.entry_basis, noticeGivenAt: noticeAt, timeZone: tz, rules: readBusinessRules(company.settings) });
  if (!check.ok) return { error: check.reason, values: typed(form) };

  const { error } = await supabase
    .from("work_order")
    .update({
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      status: "scheduled",
      entry_basis: d.entry_basis,
      entry_notice_method: d.entry_basis === "notice" ? d.notice_method : null,
      entry_notice_at: noticeAt?.toISOString() ?? null,
    })
    .eq("id", wo.id)
    .eq("company_id", company.id);
  if (error) return { error: error.message, values: typed(form) };
  await logEvent(ctx, wo.id, "scheduled", { start: start.toISOString(), end: end.toISOString(), entry_basis: d.entry_basis, notice_method: d.notice_method || null });

  let note = "";
  if (d.email_tenants) {
    const people = (wo.unit?.lease ?? []).filter((l) => l.status === "active" || l.status === "notice").flatMap((l) => l.lease_tenant).filter((t) => t.role === "tenant" && t.contact.email);
    if (!people.length) note = " No tenant email on file.";
    else {
      const content = {
        preheader: `Repair visit ${formatWhen(start.toISOString(), tz)}.`,
        heading: "Repair visit scheduled",
        fromLine: escapeHtml(company.name),
        paragraphs: [
          `Hello,`,
          `A technician is scheduled for your home at <strong>${escapeHtml(wo.property.name)}${wo.unit && wo.unit.label !== "Home" ? `, Unit ${escapeHtml(wo.unit.label)}` : ""}</strong> for: ${escapeHtml(wo.title)}.`,
          `<strong>${escapeHtml(formatWhen(start.toISOString(), tz))} to ${escapeHtml(new Date(end).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }))}</strong>`,
          d.entry_basis === "notice"
            ? "This is your notice of entry for repairs under section 83.53, Florida Statutes. You don't need to be home. If the time doesn't work, call or reply and we'll find another."
            : "If the time doesn't work, call or reply and we'll find another.",
        ],
        note: company.office_phone ? `Questions? Call ${escapeHtml(company.office_phone)}.` : undefined,
        footer: [escapeHtml(company.name), company.office_phone && escapeHtml(company.office_phone)].filter(Boolean).join(" · "),
      };
      const to = people.map((t) => t.contact.email!) ;
      const sent = await sendEmail({ to, subject: `Repair visit ${formatWhen(start.toISOString(), tz)}`, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
      await logEvent(ctx, wo.id, "tenant_notified", { to, sent, legal_notice: d.notice_method === "email_addendum" });
      note = sent ? ` Emailed ${to.length} tenant${to.length === 1 ? "" : "s"}.` : " The tenant email didn't send.";
    }
  }
  revalidatePath(`/maintenance/${wo.id}`);
  revalidatePath("/maintenance");
  return { message: `Scheduled for ${formatWhen(start.toISOString(), tz)}.${note}` };
}

// ---------- complete, cancel, notes, priority ----------

export async function completeWorkOrder(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  if (!EDIT_ROLES.includes(ctx.membership.role)) return { error: NOT_ALLOWED };
  const p = z
    .object({
      work_order_id: z.string().uuid(),
      resolution: z.string().trim().min(3, "Say what was done.").max(2000),
      cost: z
        .string()
        .trim()
        .transform((v) => v.replace(/[$,\s]/g, ""))
        .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), "Enter the cost as a dollar amount.")
        .transform((v) => (v ? Math.round(Number(v) * 100) : null)),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const { error } = await ctx.supabase
    .from("work_order")
    .update({ status: "completed", completed_at: new Date().toISOString(), resolution: p.data.resolution, cost_cents: p.data.cost })
    .eq("id", p.data.work_order_id)
    .eq("company_id", ctx.company.id);
  if (error) return { error: error.message, values: typed(form) };
  await logEvent(ctx, p.data.work_order_id, "completed", { resolution: p.data.resolution, cost_cents: p.data.cost });
  revalidatePath(`/maintenance/${p.data.work_order_id}`);
  revalidatePath("/maintenance");
  return { message: "Marked complete." };
}

export async function cancelWorkOrder(form: FormData): Promise<void> {
  const ctx = await requireCompany();
  if (!EDIT_ROLES.includes(ctx.membership.role)) return;
  const p = z.object({ work_order_id: z.string().uuid(), reason: z.string().trim().max(500) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await ctx.supabase.from("work_order").update({ status: "canceled" }).eq("id", p.data.work_order_id).eq("company_id", ctx.company.id);
  await logEvent(ctx, p.data.work_order_id, "canceled", { reason: p.data.reason || null });
  revalidatePath(`/maintenance/${p.data.work_order_id}`);
  revalidatePath("/maintenance");
}

export async function addNote(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  const p = z.object({ work_order_id: z.string().uuid(), note: z.string().trim().min(1, "Write a note.").max(2000) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: wo } = await ctx.supabase.from("work_order").select("id").eq("id", p.data.work_order_id).eq("company_id", ctx.company.id).maybeSingle();
  if (!wo) return { error: "Work order not found." };
  await logEvent(ctx, wo.id, "note", { note: p.data.note });
  revalidatePath(`/maintenance/${wo.id}`);
  return { message: "Note added." };
}

/** Staff may change the triage priority, with a reason that goes on the timeline. */
export async function changePriority(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  if (!EDIT_ROLES.includes(ctx.membership.role)) return { error: NOT_ALLOWED };
  const p = z
    .object({ work_order_id: z.string().uuid(), priority: z.enum(["routine", "urgent", "emergency"]), reason: z.string().trim().min(3, "Say why the priority changed.").max(500) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const { error } = await ctx.supabase.from("work_order").update({ priority: p.data.priority, priority_reason: p.data.reason }).eq("id", p.data.work_order_id).eq("company_id", ctx.company.id);
  if (error) return { error: error.message };
  await logEvent(ctx, p.data.work_order_id, "priority", { priority: p.data.priority, reason: p.data.reason });
  revalidatePath(`/maintenance/${p.data.work_order_id}`);
  revalidatePath("/maintenance");
  return { message: "Priority changed." };
}

/**
 * The tenant reported an emergency and accepted the false-emergency terms, and it wasn't one: charge the
 * fee they agreed to plus the vendor's emergency charge to their ledger. A person decides (never automatic),
 * and the charge is only collectible if the lease or a maintenance addendum provides for it (docs/02).
 */
export async function chargeFalseEmergency(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  const { supabase, company, membership } = ctx;
  if (!["admin", "property_manager"].includes(membership.role)) return { error: "Only an admin or property manager can charge this." };
  const p = z
    .object({
      work_order_id: z.string().uuid(),
      vendor_charge: z.string().trim().transform((v) => v.replace(/[$,\s]/g, "")).refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), "Enter the vendor's emergency charge as a dollar amount."),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: wo } = await supabase.from("work_order").select("id, number, title, emergency_ack, unit(lease(id, status))").eq("id", p.data.work_order_id).eq("company_id", company.id).maybeSingle();
  if (!wo?.emergency_ack) return { error: "The tenant didn't accept the false-emergency terms on this request." };
  const ack = wo.emergency_ack as { fee_cents?: number };
  const lease = wo.unit?.lease.find((l) => l.status === "active" || l.status === "notice");
  if (!lease) return { error: "No current lease for this unit." };
  if (wo.unit && (await supabase.from("work_order_event").select("id").eq("work_order_id", wo.id).eq("kind", "false_emergency_charged").maybeSingle()).data) return { error: "Already charged." };
  const amount = (ack.fee_cents ?? 0) + (p.data.vendor_charge ? Math.round(Number(p.data.vendor_charge) * 100) : 0);
  if (amount <= 0) return { error: "Nothing to charge." };
  const { error } = await supabase.rpc("post_charge", { p_lease: lease.id, p_type: "false_emergency", p_description: `False emergency, work order #${wo.number}`, p_amount: amount, p_due: new Date().toISOString().slice(0, 10) });
  if (error) return { error: error.message };
  await logEvent(ctx, wo.id, "false_emergency_charged", { amount_cents: amount });
  revalidatePath(`/maintenance/${wo.id}`);
  revalidatePath(`/tenants/${lease.id}`);
  return { message: `Charged $${(amount / 100).toFixed(2)} to the tenant's ledger.` };
}
