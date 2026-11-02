import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { WriteUp } from "./job-finish-rules";

// Photos and invoices go straight from the phone to storage with a one-time upload URL into the job's own
// folder, named for who added them and which stage they show (checked again when the job is saved).

export type UploadKind = "before" | "after" | "invoice";
export type UploadStart = { path?: string; uploadToken?: string; error?: string };
export type WriteUpResult = { ok: true; result: WriteUp } | { ok: false; reason: string };
export type InvoiceReadResult = { amount: string | null; number: string | null; note?: string };

const PHOTO = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];

export async function signedJobUpload(db: SupabaseClient<Database>, wo: { id: string; company_id: string }, by: "vendor" | "staff", input: { kind: UploadKind; type: string; size: number }): Promise<UploadStart> {
  if (!["before", "after", "invoice"].includes(input.kind)) return { error: "Unknown upload." };
  const allowed = input.kind === "invoice" ? ["application/pdf", ...PHOTO] : PHOTO;
  if (!allowed.includes(input.type)) return { error: input.kind === "invoice" ? "Upload the invoice as a PDF or photo." : "Add photos (JPG, PNG or HEIC)." };
  if (input.size > 15 * 1024 * 1024) return { error: "That file is too big (15 MB max)." };
  const ext = input.type === "application/pdf" ? "pdf" : input.type.split("/")[1].replace("jpeg", "jpg").replace("heif", "heic");
  const path = `${wo.company_id}/work-orders/${wo.id}/${by}-${input.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await db.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start." };
  return { path, uploadToken: data.token };
}
