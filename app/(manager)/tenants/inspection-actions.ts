"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiComplete } from "@/lib/ai/provider";
import { DEDUCTION_SYSTEM, deductionPrompt, fallbackSuggestions, parseSuggestions, readRooms, roomsSchema, suggestionsSchema, worsenedRooms } from "@/lib/inspections";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type InspectionState = { error?: string; message?: string };

const ROLES = ["admin", "property_manager", "leasing_agent", "maintenance", "accountant"];
const DECIDE_ROLES = ["admin", "property_manager", "accountant"];
const kindSchema = z.enum(["move_in", "move_out"]);
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

/** A one-time link to put a room photo straight into private storage. */
export async function startInspectionPhoto(input: { leaseId: string; kind: string; type: string; size: number }): Promise<{ path?: string; token?: string; error?: string }> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't change inspections." };
  const kind = kindSchema.safeParse(input.kind);
  const ext = PHOTO_TYPES[input.type];
  if (!kind.success) return { error: "Inspection not found." };
  if (!ext) return { error: "Use JPG, PNG, WebP or HEIC photos." };
  if (input.size > 15 * 1024 * 1024) return { error: "That photo is too big (15 MB max)." };
  const { data: lease } = await supabase.from("lease").select("id").eq("id", input.leaseId).eq("company_id", company.id).maybeSingle();
  if (!lease) return { error: "Lease not found." };
  const path = `${company.id}/inspections/${lease.id}/${kind.data}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await createAdminClient().storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start." };
  return { path, token: data.token };
}

export async function saveInspection(_: InspectionState, form: FormData): Promise<InspectionState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't change inspections." };
  const leaseId = z.string().uuid().safeParse(form.get("lease_id"));
  const kind = kindSchema.safeParse(form.get("kind"));
  const on = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(form.get("inspected_on"));
  if (!leaseId.success || !kind.success) return { error: "Inspection not found." };
  if (!on.success) return { error: "Pick the inspection date." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("rooms") ?? "[]"));
  } catch {
    return { error: "The rooms couldn't be read. Reload and try again." };
  }
  const rooms = roomsSchema.safeParse(raw);
  if (!rooms.success) return { error: "Give every room a name (40 rooms and 12 photos per room at most)." };
  const prefix = `${company.id}/inspections/${leaseId.data}/${kind.data}/`;
  if (rooms.data.some((r) => r.photos.some((p) => !p.startsWith(prefix)))) return { error: "A photo doesn't belong to this inspection." };
  const { data: lease } = await supabase.from("lease").select("id").eq("id", leaseId.data).eq("company_id", company.id).maybeSingle();
  if (!lease) return { error: "Lease not found." };
  const { error } = await supabase
    .from("inspection")
    .upsert(
      { company_id: company.id, lease_id: lease.id, kind: kind.data, inspected_on: on.data, rooms: rooms.data, notes: String(form.get("notes") ?? "").trim().slice(0, 4000) || null, created_by: user.id },
      { onConflict: "lease_id,kind" },
    );
  if (error) return { error: error.message };
  revalidatePath(`/tenants/${lease.id}/inspection/${kind.data}`);
  revalidatePath(`/tenants/${lease.id}/move-out`);
  return { message: "Saved." };
}

/**
 * Compare the move-in and move-out inspections and suggest deductions: from the company's AI when it's
 * connected, otherwise one line per room that got worse. Only rooms, conditions, notes and the tenancy
 * length go to the AI: no names, contact details or photos.
 */
export async function suggestDeductions(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!DECIDE_ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("move_out_id"));
  if (!id.success) return;
  const { data: mo } = await supabase.from("move_out").select("id, lease_id, vacated_on, decision, lease(start_date)").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!mo || mo.decision) return;
  const { data: inspections } = await supabase.from("inspection").select("kind, rooms, notes").eq("lease_id", mo.lease_id);
  const moveIn = readRooms(inspections?.find((i) => i.kind === "move_in")?.rooms);
  const out = inspections?.find((i) => i.kind === "move_out");
  const changes = worsenedRooms(moveIn, readRooms(out?.rooms));
  let suggestions = fallbackSuggestions(changes);
  if (changes.length) {
    const start = new Date(`${mo.lease?.start_date ?? mo.vacated_on}T12:00:00Z`);
    const end = new Date(`${mo.vacated_on}T12:00:00Z`);
    const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.44 * 86_400_000)));
    const r = await aiComplete({ companyId: company.id, feature: "deposit_deductions", system: DEDUCTION_SYSTEM, prompt: deductionPrompt({ months, changes, moveOutNotes: out?.notes ?? "" }), maxTokens: 900, timeoutMs: 25_000 });
    const parsed = r.ok ? parseSuggestions(r.text) : null;
    if (parsed) suggestions = parsed.map((s) => ({ ...s, reason: `${s.reason} (AI suggestion)` }));
  }
  await supabase.from("move_out").update({ suggested_deductions: suggestions }).eq("id", mo.id);
  revalidatePath(`/tenants/${mo.lease_id}/move-out`);
}

/** Add one suggestion to the deductions (a person picks it; the amount can be changed after). */
export async function applySuggestion(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!DECIDE_ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("move_out_id"));
  const index = z.coerce.number().int().min(0).safeParse(form.get("index"));
  const add = form.get("add") === "1";
  if (!id.success || !index.success) return;
  const { data: mo } = await supabase.from("move_out").select("id, lease_id, decision, deductions, suggested_deductions").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!mo || mo.decision) return;
  const suggestions = suggestionsSchema.catch([]).parse(mo.suggested_deductions);
  const picked = suggestions[index.data];
  if (!picked) return;
  const deductions = (mo.deductions as { description: string; amount_cents: number }[]) ?? [];
  await supabase
    .from("move_out")
    .update({
      suggested_deductions: suggestions.filter((_, i) => i !== index.data),
      ...(add ? { deductions: [...deductions, { description: picked.description, amount_cents: picked.amount_cents }].slice(0, 15) } : {}),
    })
    .eq("id", mo.id);
  revalidatePath(`/tenants/${mo.lease_id}/move-out`);
}
