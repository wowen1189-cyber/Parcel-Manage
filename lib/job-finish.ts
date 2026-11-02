import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agreementText } from "@/lib/agreement-import";
import { aiComplete, type AiImage } from "@/lib/ai/provider";
import { guessAmountCents, guessInvoiceNumber } from "@/lib/invoice-intake-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import {
  INVOICE_TOTAL_SYSTEM,
  officeTasks,
  parseInvoiceTotal,
  parseWriteUp,
  photosForAi,
  WRITE_UP_SYSTEM,
  writeUpPrompt,
  type FinishInput,
  type PhotoStage,
  type WriteUp,
} from "./job-finish-rules";

// Finishing a job from a phone, for both a vendor's job link and staff in the office app. Photos are
// uploaded straight to storage first (their paths are checked by the caller with jobPhotoPaths); this
// saves the result, and the AI only ever suggests text the person reviews before sending.

type Db = SupabaseClient<Database>;
export type FinishJob = { id: string; company_id: string; number: number; title: string; ai_summary: string | null; property_id: string; unit_id: string | null; vendor_id: string | null; property: { entity_id: string | null } };
export type FinishBy = { kind: "vendor" } | { kind: "staff"; profileId: string };

const AI_IMAGE = /\.(jpe?g|png|webp)$/i;
const MEDIA: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Whether the company's AI is connected and working (the AI buttons only show then). */
export async function aiReady(companyId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("ai_connection").select("status").eq("company_id", companyId).maybeSingle();
  return data?.status === "ok";
}

async function image(path: string): Promise<AiImage | null> {
  if (!AI_IMAGE.test(path)) return null;
  const { data } = await createAdminClient().storage.from("documents").download(path);
  if (!data || data.size > 4_500_000) return null;
  return { mediaType: MEDIA[path.split(".").pop()!.toLowerCase()], data: Buffer.from(await data.arrayBuffer()).toString("base64") };
}

/** The AI's write-up from the tech's notes and photos. What it suggested is kept on the work order (rule 4). */
export async function writeUpJob(job: FinishJob, input: { notes: string; parts: string; photos: { path: string; stage: PhotoStage }[] }): Promise<{ ok: true; result: WriteUp } | { ok: false; reason: string }> {
  if (input.notes.trim().length < 3 && !input.photos.length) return { ok: false, reason: "Add a few words or a photo first." };
  const chosen = photosForAi(input.photos);
  const loaded = (await Promise.all(chosen.map(async (p) => ({ stage: p.stage, img: await image(p.path) })))).filter((x): x is { stage: PhotoStage; img: AiImage } => !!x.img);
  const r = await aiComplete({
    companyId: job.company_id,
    feature: "job write-up",
    system: WRITE_UP_SYSTEM,
    prompt: writeUpPrompt({ title: job.title, problem: job.ai_summary, notes: input.notes, parts: input.parts, photos: loaded.map((x) => x.stage) }),
    images: loaded.map((x) => x.img),
    maxTokens: 700,
    timeoutMs: 45_000,
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  const result = parseWriteUp(r.text);
  if (!result) return { ok: false, reason: "The AI's answer couldn't be used. Write it in your own words." };
  await createAdminClient()
    .from("work_order")
    .update({ completion_ai: { at: new Date().toISOString(), notes: input.notes.slice(0, 3000), parts: input.parts.slice(0, 400), photos: loaded.length, suggestion: result } as never })
    .eq("id", job.id)
    .eq("company_id", job.company_id);
  return { ok: true, result };
}

/** The total and invoice number from an uploaded invoice: AI when connected, else a text search of a PDF. */
export async function readJobInvoice(job: FinishJob, path: string): Promise<{ amount: string | null; number: string | null; note?: string }> {
  const { data } = await createAdminClient().storage.from("documents").download(path);
  if (!data) return { amount: null, number: null, note: "The invoice couldn't be opened." };
  const bytes = new Uint8Array(await data.arrayBuffer());
  const isPdf = path.endsWith(".pdf");
  const text = isPdf ? await agreementText(bytes, "pdf").catch(() => "") : "";
  const img = !isPdf && AI_IMAGE.test(path) && bytes.length <= 4_500_000 ? { mediaType: MEDIA[path.split(".").pop()!.toLowerCase()], data: Buffer.from(bytes).toString("base64") } : null;
  const fmt = (c: number | null) => (c ? (c / 100).toFixed(2) : null);
  if (text.trim() || img) {
    const r = await aiComplete({ companyId: job.company_id, feature: "invoice reading", system: INVOICE_TOTAL_SYSTEM, prompt: text ? `INVOICE:\n${text.slice(0, 12000)}` : "The invoice is in the photo.", images: img ? [img] : undefined, maxTokens: 120, timeoutMs: 30_000 });
    const read = r.ok ? parseInvoiceTotal(r.text) : null;
    if (read && (read.amountCents || read.invoiceNumber)) return { amount: fmt(read.amountCents), number: read.invoiceNumber };
  }
  if (text.trim()) {
    const amount = guessAmountCents(text);
    const number = guessInvoiceNumber(text);
    if (amount || number) return { amount: fmt(amount), number };
  }
  return { amount: null, number: null, note: "Couldn't read the total. Type it in." };
}

/**
 * Save a finished job: photos, the write-up and details, the office's to-dos, and for a vendor the invoice
 * as a bill waiting for approval. `db` is the person's own client for staff (so the audit log shows who),
 * or the service role for a vendor's job link; every write is scoped to this job's company.
 */
export async function saveFinish(db: Db, job: FinishJob, input: FinishInput, files: { before: string[]; after: string[]; invoicePath: string | null }, by: FinishBy, today: string) {
  const uploadedBy = by.kind === "staff" ? by.profileId : null;
  const source = by.kind === "vendor" ? "vendor portal" : "staff";
  const photoRows = [
    ...files.before.map((path) => ({ path, stage: "before" as const })),
    ...files.after.map((path) => ({ path, stage: "after" as const })),
  ].map((p) => ({ company_id: job.company_id, work_order_id: job.id, property_id: job.property_id, storage_path: p.path, file_name: p.stage === "before" ? "Before photo" : "After photo", category: "photo", photo_stage: p.stage, source, uploaded_by: uploadedBy }));
  if (photoRows.length) await db.from("document").insert(photoRows);

  let billId: string | null = null;
  if (by.kind === "vendor" && input.amount) {
    const { data: doc } = files.invoicePath
      ? await db.from("document").insert({ company_id: job.company_id, work_order_id: job.id, property_id: job.property_id, vendor_id: job.vendor_id, storage_path: files.invoicePath, file_name: `Invoice${input.invoice_number ? ` ${input.invoice_number}` : ""}`, category: "invoice", source }).select("id").single()
      : { data: null };
    const { data: bill } = await db
      .from("bill")
      .insert({
        company_id: job.company_id,
        entity_id: job.property.entity_id,
        vendor_id: job.vendor_id,
        property_id: job.property_id,
        unit_id: job.unit_id,
        work_order_id: job.id,
        invoice_number: input.invoice_number || null,
        invoice_date: today,
        amount_cents: input.amount,
        memo: `Work order #${job.number}: ${job.title}`,
        status: "received",
        source: "vendor portal",
        document_id: doc?.id ?? null,
      })
      .select("id")
      .single();
    if (doc && bill) await db.from("document").update({ bill_id: bill.id }).eq("id", doc.id);
    billId = bill?.id ?? null;
  }

  const followUp = input.fixed === "no" ? input.follow_up_note : null;
  const damage = input.damage === "yes" ? input.damage_note : null;
  const { data: current } = await db.from("work_order").select("completion_ai").eq("id", job.id).eq("company_id", job.company_id).maybeSingle();
  const ai = current?.completion_ai as { suggestion?: WriteUp } | null;
  const now = new Date().toISOString();
  const { error } = await db
    .from("work_order")
    .update({
      status: "completed",
      completed_at: now,
      ...(by.kind === "vendor" ? { vendor_completed_at: now } : {}),
      resolution: input.resolution,
      cost_cents: input.amount,
      parts_used: input.parts || null,
      hours_on_site: input.hours,
      follow_up_needed: !!followUp,
      follow_up_note: followUp,
      tenant_damage_suspected: !!damage,
      tenant_damage_note: damage,
      ...(ai?.suggestion ? { completion_ai: { ...ai, used_as_written: ai.suggestion.writeUp.trim() === input.resolution.trim() } as never } : {}),
    })
    .eq("id", job.id)
    .eq("company_id", job.company_id);
  if (error) throw new Error("The job couldn't be saved. Please try again.");

  await db.from("work_order_event").insert({
    company_id: job.company_id,
    work_order_id: job.id,
    kind: "completed",
    actor_profile_id: uploadedBy,
    detail: { by: by.kind, resolution: input.resolution, cost_cents: input.amount, before_photos: files.before.length, after_photos: files.after.length, follow_up: followUp, tenant_damage: damage, ai_write_up: !!ai?.suggestion } as never,
  });
  const tasks = officeTasks({ workOrderId: job.id, number: job.number, title: job.title, followUpNote: followUp, damageNote: damage, today });
  // A finished job can be reopened and finished again; keep the newest to-do.
  for (const t of tasks) await db.from("automation_task").upsert({ company_id: job.company_id, status: "open", ...t }, { onConflict: "company_id,key" });
  return { billId, followUp, damage };
}
