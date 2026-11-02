"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { agreementText, AGREEMENT_UPLOAD_TYPES } from "@/lib/agreement-import";
import { builtinParts, defaultTemplateId, partsSchema, textToParts, unknownFields } from "@/lib/agreement-templates";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type TemplateState = { error?: string; message?: string };

const ROLES = ["admin", "property_manager"];
const NOT_ALLOWED = "Only an admin or property manager can change agreement templates.";

async function staff() {
  const ctx = await requireCompany();
  return { ...ctx, allowed: ROLES.includes(ctx.membership.role) };
}

/** Step 1 of an upload: a one-time link to put the file in storage (files are too big for a form post). */
export async function startTemplateUpload(input: { type: string; size: number }): Promise<{ path?: string; token?: string; error?: string }> {
  const { company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const ext = AGREEMENT_UPLOAD_TYPES[input.type];
  if (!ext) return { error: "Upload a PDF or a Word file (.docx). For a Google Doc, choose File › Download › PDF or Word." };
  if (input.size > 15 * 1024 * 1024) return { error: "That file is too big (15 MB max)." };
  const path = `${company.id}/agreement-templates/${Date.now()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start." };
  return { path, token: data.token };
}

/** Step 2: read the uploaded file's text, split it into parts at its headings, and save it as a template. */
export async function importTemplate(input: { path: string; fileName: string }): Promise<{ id?: string; error?: string }> {
  const { supabase, company, user, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  if (!input.path.startsWith(`${company.id}/agreement-templates/`)) return { error: NOT_ALLOWED };
  const kind = input.path.endsWith(".docx") ? "docx" : "pdf";
  const { data: file } = await createAdminClient().storage.from("documents").download(input.path);
  if (!file) return { error: "The upload didn't arrive. Please try again." };
  let text = "";
  try {
    text = await agreementText(new Uint8Array(await file.arrayBuffer()), kind);
  } catch {
    return { error: "That file couldn't be read. Try saving it again as a PDF or Word file." };
  }
  const parts = textToParts(text);
  if (!parts.length) return { error: "No text was found in that file. A scanned PDF is a picture of text: upload the Word or Google Docs version instead." };
  const name = input.fileName.replace(/\.(pdf|docx)$/i, "").trim().slice(0, 120) || "My management agreement";
  const { data, error } = await supabase
    .from("agreement_template")
    .insert({ company_id: company.id, name, parts, source_path: input.path, source_name: input.fileName.slice(0, 200), created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/management-agreements/templates");
  return { id: data.id };
}

/** A new template copied from Parcel Manage's Florida agreement, or blank. */
export async function createTemplate(form: FormData): Promise<void> {
  const { supabase, company, user, allowed } = await staff();
  if (!allowed) return;
  const copy = form.get("from") === "builtin";
  const { data } = await supabase
    .from("agreement_template")
    .insert({
      company_id: company.id,
      name: copy ? `${company.name} management agreement` : "New management agreement",
      parts: copy ? builtinParts() : [{ id: "p1", heading: "1. Parties", body: "This Property Management Agreement is made on {{agreement_date}} between {{owner_name}} (\"Owner\") and {{agent_name}} (\"Agent\").", when: null }],
      created_by: user.id,
    })
    .select("id")
    .single();
  if (!data) return;
  redirect(`/management-agreements/templates/${data.id}`);
}

export async function saveTemplate(_: TemplateState, form: FormData): Promise<TemplateState> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Template not found." };
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 120) return { error: "Give the template a name (up to 120 characters)." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("parts") ?? "[]"));
  } catch {
    return { error: "The template couldn't be read. Reload the page and try again." };
  }
  const parts = partsSchema.safeParse(raw);
  if (!parts.success) return { error: "A part is too long or the template has too many parts (200 max)." };
  const kept = parts.data.filter((p) => p.heading || p.body.trim());
  if (!kept.length) return { error: "Add at least one part." };
  const unknown = unknownFields(kept);
  if (unknown.length) return { error: `These blanks aren't ones Parcel Manage can fill: ${unknown.map((k) => `{{${k}}}`).join(", ")}. Pick blanks from "Insert a blank" instead.` };
  const { error } = await supabase.from("agreement_template").update({ name, parts: kept }).eq("id", id.data).eq("company_id", company.id);
  if (error) return { error: error.message };
  revalidatePath(`/management-agreements/templates/${id.data}`);
  revalidatePath("/management-agreements/templates");
  return { message: `Saved. Drafts using it update now; agreements already sent keep the wording they were sent with.` };
}

export async function deleteTemplate(form: FormData): Promise<void> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const { data: t } = await supabase.from("agreement_template").select("id, source_path").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!t) return;
  // Drafts that used it go back to Parcel Manage's agreement (the column is "on delete set null"); sent and
  // signed agreements keep their frozen copy.
  await supabase.from("agreement_template").delete().eq("id", t.id);
  if (t.source_path) await createAdminClient().storage.from("documents").remove([t.source_path]);
  if (defaultTemplateId(company.settings) === t.id) {
    const settings = { ...((company.settings as Record<string, unknown>) ?? {}), agreementTemplateId: null };
    await supabase.from("company").update({ settings }).eq("id", company.id);
  }
  revalidatePath("/management-agreements/templates");
  redirect("/management-agreements/templates");
}

/** The template new agreements start with ("" = Parcel Manage's Florida agreement). Admins only. */
export async function setDefaultTemplate(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (membership.role !== "admin") return;
  let id: string | null = String(form.get("id") ?? "") || null;
  if (id) {
    const { data: t } = await supabase.from("agreement_template").select("id").eq("id", id).eq("company_id", company.id).maybeSingle();
    if (!t) id = null;
  }
  const settings = { ...((company.settings as Record<string, unknown>) ?? {}), agreementTemplateId: id };
  await supabase.from("company").update({ settings }).eq("id", company.id);
  revalidatePath("/management-agreements/templates");
}

