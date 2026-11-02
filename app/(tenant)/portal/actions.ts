"use server";

import { after } from "next/server";
import { improveTechnicianSummary } from "@/lib/ai/technician";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readBusinessRules } from "@/lib/business-rules";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { requireTenant } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyUrl } from "@/lib/tenant";
import { FALSE_EMERGENCY_ACK, findSymptom, PRIORITY_DB, SAFETY_OPTIONS, technicianSummary, triagePriority } from "@/lib/triage";

// Tenant portal actions. Writes go through the tenant's own session, so Row Level Security (migration
// 0017) decides what they may touch. The service role is used only to read the company's settings and
// office e-mail, and to store photos after the tenant's access to the request is confirmed.

export type PortalState = { error?: string; message?: string; values?: Record<string, string> };
const typed = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

async function companyPrivate(companyId: string) {
  const { data } = await createAdminClient().from("company").select("settings, office_email, subdomain, name, time_zone").eq("id", companyId).single();
  return data!;
}

async function tellOffice(companyId: string, subject: string, heading: string, paragraphs: string[], path: string) {
  const c = await companyPrivate(companyId);
  if (!c.office_email || !c.subdomain) return;
  const content = { preheader: subject, heading, paragraphs, button: { label: "Open in Parcel Manage", url: companyUrl(c.subdomain, ROOT_DOMAIN, path) }, fromLine: c.name };
  await sendEmail({ to: c.office_email, subject, html: emailHtml(content), text: emailText(content), fromName: "Parcel Manage" });
}

/** A repair request from the tenant, with the same triage as the office. Priority comes from the answers. */
export async function createRequest(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase, company, lease, me } = await requireTenant();
  const d = z
    .object({
      safety: z.enum(["", "gas", "fire"]),
      category: z.string(),
      item: z.string(),
      symptom: z.string(),
      room: z.string().max(60).optional(),
      entry_ok: z.enum(["", "yes", "no"]),
      pets: z.enum(["", "yes", "no"]),
      tenant_note: z.string().trim().max(2000).optional(),
      ack: z.literal("on").optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return { error: "Please answer the questions above.", values: typed(form) };
  const v = d.data;
  const answers: Record<string, string> = {};
  for (const [k, val] of form.entries()) if (k.startsWith("q_") && String(val)) answers[k.slice(2)] = String(val);

  let priority: "routine" | "urgent" | "emergency";
  let title: string;
  let summary: string;
  let ack: Record<string, unknown> | null = null;
  if (v.safety) {
    // Gas or fire: no questions, no acknowledgment, never discourage reporting danger.
    const s = SAFETY_OPTIONS.find((o) => o.id === v.safety)!;
    priority = "emergency";
    title = v.safety === "gas" ? "Gas smell reported" : "Smoke, fire or sparks reported";
    summary = `Priority: Emergency (safety report from the tenant: ${s.label}). ${v.tenant_note ?? ""}`.trim();
  } else {
    const found = findSymptom(v.category, v.item, v.symptom);
    if (!found) return { error: "Choose what the problem is.", values: typed(form) };
    if (found.symptom.descriptionRequired && !v.tenant_note) return { error: "Please describe the problem.", values: typed(form) };
    const p = triagePriority(found.symptom, answers);
    priority = PRIORITY_DB[p.priority];
    title = `${found.item.label}: ${found.symptom.label}`;
    summary = technicianSummary({ priority: p.priority, item: found.item.label, symptom: found.symptom, answers, room: v.room, entryOk: v.entry_ok ? v.entry_ok === "yes" : null, pets: v.pets ? v.pets === "yes" : null, note: v.tenant_note });
    if (priority === "emergency") {
      const rules = readBusinessRules((await companyPrivate(company.id)).settings);
      const text = FALSE_EMERGENCY_ACK.replace("{fee}", `$${(rules.maintenance.falseEmergencyFeeCents / 100).toFixed(0)}`);
      if (!v.ack) return { error: "Please confirm the emergency statement to send this as an emergency.", values: typed(form) };
      ack = { text, fee_cents: rules.maintenance.falseEmergencyFeeCents, accepted_at: new Date().toISOString(), answers };
    }
  }

  const { data: wo, error } = await supabase
    .from("work_order")
    .insert({
      company_id: company.id,
      property_id: lease.unit.property.id,
      unit_id: lease.unit.id,
      source: "portal",
      status: "new",
      title,
      triage_category: v.safety ? "safety" : v.category,
      triage_item: v.safety || v.item,
      triage_symptom: v.safety || v.symptom,
      triage_answers: answers,
      priority,
      emergency_ack: ack as never,
      room: v.room || null,
      entry_ok: v.entry_ok ? v.entry_ok === "yes" : null,
      pets_in_home: v.pets ? v.pets === "yes" : null,
      tenant_note: v.tenant_note || null,
      ai_summary: summary,
      reported_by_contact_id: me.id,
      // "OK to enter if I'm not home" is not consent to a time; the office still gives 83.53(2) notice when scheduling.
      entry_basis: priority === "emergency" ? "emergency" : null,
    })
    .select("id, number")
    .single();
  if (error) return { error: "Your request couldn't be sent. Please try again or call the office.", values: typed(form) };
  after(() => improveTechnicianSummary(company.id, wo.id));
  await supabase.from("work_order_event").insert({ company_id: company.id, work_order_id: wo.id, kind: "created", detail: { source: "portal", priority }, actor_profile_id: (await supabase.auth.getUser()).data.user!.id });
  await tellOffice(
    company.id,
    `${priority === "emergency" ? "EMERGENCY " : ""}repair request #${wo.number}: ${title}`,
    `New ${priority} repair request`,
    [`<strong>${escapeHtml(title)}</strong> at ${escapeHtml(lease.unit.property.name)}${lease.unit.label !== "Home" ? `, unit ${escapeHtml(lease.unit.label)}` : ""}.`, escapeHtml(summary)],
    `/maintenance/${wo.id}`,
  );
  revalidatePath("/portal");
  redirect(`/portal/maintenance/${wo.id}?sent=1`);
}

/** Photo for a request: step 1, a one-time upload URL into that request's folder. */
export async function startPhotoUpload(input: { workOrderId: string; type: string; size: number }): Promise<{ path?: string; token?: string; error?: string }> {
  const { supabase, company } = await requireTenant();
  if (!["image/jpeg", "image/png", "image/heic", "image/webp"].includes(input.type)) return { error: "Add a photo (JPG, PNG or HEIC)." };
  if (input.size > 15 * 1024 * 1024) return { error: "That photo is too big (15 MB max)." };
  const { data: wo } = await supabase.from("work_order").select("id").eq("id", input.workOrderId).maybeSingle();
  if (!wo) return { error: "Request not found." };
  const ext = input.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${company.id}/work-orders/${wo.id}/tenant-${Date.now()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start." };
  return { path, token: data.token };
}

/** Photo step 2: file it on the request. */
export async function finishPhotoUpload(input: { workOrderId: string; path: string }): Promise<{ error?: string }> {
  const { supabase, company, lease } = await requireTenant();
  const { data: wo } = await supabase.from("work_order").select("id").eq("id", input.workOrderId).maybeSingle();
  if (!wo || !input.path.startsWith(`${company.id}/work-orders/${wo.id}/tenant-`)) return { error: "Request not found." };
  await createAdminClient().from("document").insert({ company_id: company.id, work_order_id: wo.id, lease_id: lease.id, storage_path: input.path, file_name: "Photo from tenant", category: "photo", source: "tenant portal" });
  revalidatePath(`/portal/maintenance/${wo.id}`);
  return {};
}

/** A message to the office from the portal. */
export async function sendMessage(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase, company, lease, me } = await requireTenant();
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 2) return { error: "Write your message." };
  if (body.length > 4000) return { error: "That message is too long." };
  const { error } = await supabase.from("message").insert({
    company_id: company.id,
    thread_key: `contact:${me.id}`,
    contact_id: me.id,
    lease_id: lease.id,
    channel: "portal",
    direction: "inbound",
    status: "received",
    sender_name: [me.first_name, me.last_name].filter(Boolean).join(" ") || me.business_name,
    body,
  });
  if (error) return { error: "Your message couldn't be sent. Please try again.", values: { body } };
  await tellOffice(company.id, `Portal message from ${[me.first_name, me.last_name].filter(Boolean).join(" ")}`, "New message from a tenant", [escapeHtml(body)], `/tenants/${lease.id}`);
  revalidatePath("/portal/messages");
  return { message: "Sent. The office will reply here." };
}

/** Notice that the tenant is moving out: sent to the office as a message (the lease's notice terms apply). */
export async function giveNotice(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase, company, lease, me } = await requireTenant();
  const parsed = z.object({ move_out_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose your move-out date."), forwarding: z.string().trim().max(300).optional(), confirm: z.literal("on", { message: "Please confirm the notice." }) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const body = `Notice to vacate: I plan to move out on ${parsed.data.move_out_on}.${parsed.data.forwarding ? ` Forwarding address: ${parsed.data.forwarding}.` : ""}`;
  const { error } = await supabase.from("message").insert({ company_id: company.id, thread_key: `contact:${me.id}`, contact_id: me.id, lease_id: lease.id, channel: "portal", direction: "inbound", status: "received", sender_name: [me.first_name, me.last_name].filter(Boolean).join(" "), body });
  if (error) return { error: "Your notice couldn't be sent. Please try again or contact the office.", values: typed(form) };
  await tellOffice(company.id, `Notice to vacate: ${lease.unit.property.name}${lease.unit.label !== "Home" ? ` ${lease.unit.label}` : ""}`, "A tenant gave notice", [escapeHtml(body), "Review the lease's notice terms, confirm in writing, and set the move-out date on the tenant's lease."], `/tenants/${lease.id}`);
  revalidatePath("/portal/messages");
  return { message: "Your notice was sent to the office. They'll confirm in writing." };
}

/** Household details the tenant keeps current: vehicles and emergency contacts. */
export async function saveHousehold(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase, company, lease, me } = await requireTenant();
  const kind = String(form.get("kind"));
  if (kind === "vehicle") {
    const v = z.object({ make_model: z.string().trim().min(2, "Enter the year, make and model.").max(80), color: z.string().trim().max(30).optional(), tag_number: z.string().trim().max(15).optional(), tag_state: z.string().trim().max(2).optional() }).safeParse(Object.fromEntries(form));
    if (!v.success) return { error: v.error.issues[0].message, values: typed(form) };
    const { error } = await supabase.from("vehicle").insert({ company_id: company.id, lease_id: lease.id, tenant_contact_id: me.id, ...v.data, tag_state: (v.data.tag_state || "FL").toUpperCase(), updated_source: "tenant_portal" });
    if (error) return { error: "Couldn't save. Please try again.", values: typed(form) };
  } else if (kind === "emergency") {
    const v = z.object({ name: z.string().trim().min(2, "Enter their name.").max(80), relationship: z.string().trim().max(40).optional(), phone: z.string().trim().min(7, "Enter their phone.").max(30) }).safeParse(Object.fromEntries(form));
    if (!v.success) return { error: v.error.issues[0].message, values: typed(form) };
    const { error } = await supabase.from("emergency_contact").insert({ company_id: company.id, tenant_contact_id: me.id, ...v.data, updated_source: "tenant_portal" });
    if (error) return { error: "Couldn't save. Please try again.", values: typed(form) };
  } else return { error: "Unknown item." };
  revalidatePath("/portal/lease");
  return { message: "Saved." };
}

export async function removeHousehold(form: FormData): Promise<void> {
  const { supabase } = await requireTenant();
  const id = z.string().uuid().safeParse(form.get("id"));
  const table = form.get("kind") === "vehicle" ? "vehicle" : "emergency_contact";
  if (id.success) await supabase.from(table).delete().eq("id", id.data);
  revalidatePath("/portal/lease");
}

/** Proof of renters insurance: details plus the declarations page, reviewed by the office. */
export async function startInsuranceUpload(input: { type: string; size: number }): Promise<{ path?: string; token?: string; error?: string }> {
  const { company, lease } = await requireTenant();
  if (!["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"].includes(input.type)) return { error: "Upload a PDF or photo." };
  if (input.size > 15 * 1024 * 1024) return { error: "That file is too big (15 MB max)." };
  const ext = input.type === "application/pdf" ? "pdf" : input.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${company.id}/leases/${lease.id}/insurance-${Date.now()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start." };
  return { path, token: data.token };
}

export async function saveInsurance(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase, company, lease, me } = await requireTenant();
  const v = z
    .object({ carrier: z.string().trim().min(2, "Enter the insurance company.").max(80), policy_number: z.string().trim().min(2, "Enter the policy number.").max(60), expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the policy ends."), path: z.string().optional() })
    .safeParse(Object.fromEntries(form));
  if (!v.success) return { error: v.error.issues[0].message, values: typed(form) };
  let documentId: string | null = null;
  if (v.data.path) {
    if (!v.data.path.startsWith(`${company.id}/leases/${lease.id}/insurance-`)) return { error: "Please upload the file again." };
    const { data } = await createAdminClient().from("document").insert({ company_id: company.id, lease_id: lease.id, contact_id: me.id, storage_path: v.data.path, file_name: "Renters insurance declarations", category: "insurance", source: "tenant portal" }).select("id").single();
    documentId = data?.id ?? null;
  }
  const { error } = await supabase.from("renters_insurance").insert({ company_id: company.id, lease_id: lease.id, tenant_contact_id: me.id, carrier: v.data.carrier, policy_number: v.data.policy_number, expires_on: v.data.expires_on, document_id: documentId, status: "in_review", updated_source: "tenant_portal" });
  if (error) return { error: "Couldn't save. Please try again.", values: typed(form) };
  await tellOffice(company.id, `Renters insurance uploaded: ${lease.unit.property.name}`, "Renters insurance to review", [`${escapeHtml(v.data.carrier)}, policy ${escapeHtml(v.data.policy_number)}, ends ${v.data.expires_on}. Check that the company is listed as interested party.`], `/tenants/${lease.id}`);
  revalidatePath("/portal/lease");
  return { message: "Thanks! The office will review it." };
}

/** The tenant turns texts on (with the consent wording and their mobile number) or off. */
export async function setTexts(_: PortalState, form: FormData): Promise<PortalState> {
  const { company, me } = await requireTenant();
  const db = createAdminClient();
  if (form.get("texts") !== "on") {
    await db.from("contact").update({ sms_opt_in: false, sms_opt_out_at: new Date().toISOString() }).eq("id", me.id).eq("company_id", company.id);
    revalidatePath("/portal/lease");
    return { message: "Texts are off. We'll use e-mail and the portal." };
  }
  const mobile = String(form.get("mobile") ?? "").trim();
  if (mobile.replace(/\D/g, "").length < 10) return { error: "Enter your 10-digit mobile number.", values: { mobile } };
  if (form.get("agree") !== "on") return { error: "Check the box to agree to texts.", values: { mobile } };
  await db.from("contact").update({ mobile, sms_opt_in: true, sms_opt_in_at: new Date().toISOString(), sms_opt_out_at: null }).eq("id", me.id).eq("company_id", company.id);
  revalidatePath("/portal/lease");
  return { message: "Texts are on. Reply STOP to any text to turn them off." };
}
