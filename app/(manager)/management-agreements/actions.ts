"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { defaultTemplateId } from "@/lib/agreement-templates";
import { documentToText } from "@/lib/documents/text";
import { inviteNextSigner, sha256 } from "@/lib/esign";
import { agreementEndDate, agreementTermsFromForm, readAgreementDefaults } from "@/lib/management-agreement";
import { loadAgreement } from "@/lib/management-agreement-data";
import { requireCompany } from "@/lib/session";

export type AgreementState = { error?: string; message?: string; values?: Record<string, string> };

const ROLES = ["admin", "property_manager"];
const NOT_ALLOWED = "Only an admin or property manager can prepare management agreements.";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the start date.");

function typed(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
}

function details(form: FormData) {
  return z
    .object({
      start_date: isoDate,
      signer_name: z.string().trim().min(2, "Enter who signs for the owner.").max(120),
      signer_title: z.string().trim().max(80),
      signer_email: z.union([z.literal(""), z.string().trim().email("Enter a valid e-mail for the signer.")]),
    })
    .safeParse(Object.fromEntries(form));
}

/** New agreement for an owner: all their properties, the company's default terms and the owner's reserve. */
export async function createAgreement(form: FormData): Promise<void> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const ownerId = z.string().uuid().safeParse(form.get("entity_id"));
  if (!ownerId.success) return;
  const { data: owner } = await supabase.from("entity").select("id, reserve_cents, property(id)").eq("id", ownerId.data).eq("company_id", company.id).maybeSingle();
  if (!owner) return;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: company.time_zone });
  const [y, m] = today.split("-").map(Number);
  // Starts on the 1st of next month, the usual hand-off date.
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const terms = { ...readAgreementDefaults(company.settings), reserveCents: owner.reserve_cents ?? 0 };
  const preferred = defaultTemplateId(company.settings);
  const { data: tmpl } = preferred ? await supabase.from("agreement_template").select("id").eq("id", preferred).eq("company_id", company.id).maybeSingle() : { data: null };
  const { data, error } = await supabase
    .from("management_agreement")
    .insert({ company_id: company.id, entity_id: owner.id, property_ids: owner.property.map((p) => p.id), start_date: start, end_date: agreementEndDate(start, terms.termYears), terms, template_id: tmpl?.id ?? null, created_by: user.id })
    .select("id")
    .single();
  if (error) return;
  redirect(`/management-agreements/${data.id}`);
}

/** Save the draft: properties covered, start date, signer, and the terms. An admin can also make the terms the company's defaults. */
export async function saveAgreement(_: AgreementState, form: FormData): Promise<AgreementState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Agreement not found." };
  const { data: a } = await supabase.from("management_agreement").select("id, status, entity_id").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!a) return { error: "Agreement not found." };
  if (a.status !== "draft") return { error: "Only a draft can be changed. Void the signature request first, or start a new agreement." };
  const d = details(form);
  if (!d.success) return { error: d.error.issues[0].message, values: typed(form) };
  const t = agreementTermsFromForm(Object.fromEntries(form));
  if (!t.terms) return { error: t.error, values: typed(form) };
  const { data: owned } = await supabase.from("property").select("id").eq("company_id", company.id).eq("entity_id", a.entity_id);
  const ownedIds = new Set((owned ?? []).map((p) => p.id));
  const propertyIds = form.getAll("property_id").map(String).filter((p) => ownedIds.has(p));
  if (!propertyIds.length) return { error: "Pick at least one property.", values: typed(form) };
  // "" is Parcel Manage's Florida agreement; otherwise one of the company's own templates.
  let templateId: string | null = String(form.get("template_id") ?? "") || null;
  if (templateId) {
    const { data: t } = await supabase.from("agreement_template").select("id").eq("id", templateId).eq("company_id", company.id).maybeSingle();
    if (!t) templateId = null;
  }
  const { error } = await supabase
    .from("management_agreement")
    .update({
      property_ids: propertyIds,
      start_date: d.data.start_date,
      end_date: agreementEndDate(d.data.start_date, t.terms.termYears),
      owner_signer_name: d.data.signer_name,
      owner_signer_title: d.data.signer_title || null,
      owner_signer_email: d.data.signer_email || null,
      terms: t.terms,
      template_id: templateId,
    })
    .eq("id", a.id);
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath(`/management-agreements/${a.id}`);
  if (form.get("intent") !== "defaults") return { message: "Saved." };
  if (membership.role !== "admin") return { error: "Saved, but only an admin can change the company's default terms." };
  // The owner's reserve is per owner, so it isn't part of the defaults.
  const defaults: Partial<typeof t.terms> = { ...t.terms };
  delete defaults.reserveCents;
  const settings = { ...((company.settings as Record<string, unknown>) ?? {}), agreementDefaults: defaults };
  const saved = await supabase.from("company").update({ settings }).eq("id", company.id);
  if (saved.error) return { error: saved.error.message };
  revalidatePath("/management-agreements/template");
  return { message: "Saved. New agreements will start with these terms." };
}

/**
 * Freeze the filled agreement and send it: the owner's signer first, then you (the broker) last.
 * The signed PDF and its certificate are filed on the owner.
 */
export async function sendAgreement(_: AgreementState, form: FormData): Promise<AgreementState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Agreement not found." };
  const found = await loadAgreement(supabase, company, id.data);
  if (!found) return { error: "Agreement not found." };
  const a = found.agreement;
  if (a.status !== "draft") return { error: "This agreement was already sent." };
  if (found.missing.length) return { error: `Fill these in first: ${found.missing.join("; ")}.` };
  const { data: me } = await supabase.from("profile").select("full_name, email").eq("id", user.id).single();
  const agentEmail = me?.email ?? company.office_email;
  if (!agentEmail) return { error: "Add your e-mail to your profile first." };
  const snapshot = [documentToText(found.template, found.values, found.conditions)];
  const title = `Property Management Agreement: ${a.entity.name}`;
  const { data: req, error } = await supabase
    .from("signature_request")
    .insert({ company_id: company.id, management_agreement_id: a.id, title, snapshot: snapshot as never, snapshot_sha256: sha256(JSON.stringify(snapshot)), created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await supabase.from("signature_signer").insert([
    { company_id: company.id, request_id: req.id, role: "owner", name: a.owner_signer_name!, email: (a.owner_signer_email ?? a.entity.email!).split(/[,;]/)[0].trim(), sign_order: 1 },
    { company_id: company.id, request_id: req.id, role: "agent", name: me?.full_name ?? company.name, email: agentEmail, sign_order: 2 },
  ]);
  await supabase.from("signature_event").insert({ company_id: company.id, request_id: req.id, kind: "created" });
  // Freeze the company template's text with the agreement, so later edits to the template don't change it.
  const { data: own } = a.template_id ? await supabase.from("agreement_template").select("name, parts").eq("id", a.template_id).maybeSingle() : { data: null };
  await supabase
    .from("management_agreement")
    .update({ status: "sent", ...(own ? { template_parts: own.parts, template_name: own.name } : {}) })
    .eq("id", a.id);
  const sent = await inviteNextSigner(company, req.id);
  revalidatePath(`/management-agreements/${a.id}`);
  revalidatePath("/management-agreements");
  return sent.ok ? { message: `Sent to ${sent.to}. You get your link to sign after they sign.` } : { error: "Saved, but the e-mail didn't send. Void it and try again." };
}

/** Cancel an unsigned request; the agreement goes back to draft. */
export async function voidAgreementRequest(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("request_id"));
  if (!id.success) return;
  const { data: req } = await supabase.from("signature_request").select("id, status, management_agreement_id").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!req || req.status !== "sent" || !req.management_agreement_id) return;
  await supabase.from("signature_request").update({ status: "voided" }).eq("id", req.id);
  await supabase.from("signature_signer").update({ token_hash: null }).eq("request_id", req.id);
  await supabase.from("signature_event").insert({ company_id: company.id, request_id: req.id, kind: "voided" });
  // Back to a draft that follows its template again.
  await supabase.from("management_agreement").update({ status: "draft", template_parts: null, template_name: null }).eq("id", req.management_agreement_id).eq("status", "sent");
  revalidatePath(`/management-agreements/${req.management_agreement_id}`);
}

/** Record that a signed agreement ended (notice given, or the owner sold). */
export async function endAgreement(_: AgreementState, form: FormData): Promise<AgreementState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("id"));
  const on = isoDate.safeParse(form.get("ended_on"));
  if (!id.success) return { error: "Agreement not found." };
  if (!on.success) return { error: "Pick the date it ends." };
  const { error } = await supabase.from("management_agreement").update({ status: "ended", ended_on: on.data }).eq("id", id.data).eq("company_id", company.id).eq("status", "signed");
  if (error) return { error: error.message };
  revalidatePath(`/management-agreements/${id.data}`);
  return { message: "Marked as ended." };
}

/** Delete a draft that was never sent. */
export async function deleteDraftAgreement(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const { data: sent } = await supabase.from("signature_request").select("id").eq("management_agreement_id", id.data).limit(1);
  if (sent?.length) return;
  await supabase.from("management_agreement").delete().eq("id", id.data).eq("company_id", company.id).eq("status", "draft");
  revalidatePath("/management-agreements");
  redirect("/management-agreements");
}
