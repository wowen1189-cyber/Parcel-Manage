"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inviteNextSigner, sha256Bytes } from "@/lib/esign";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = ["admin", "property_manager", "leasing_agent", "accountant"];
const NOT_ALLOWED = "Your role can't send documents for signature.";

/** A one-time link to put the PDF straight into private storage. */
export async function startEsignUpload(input: { type: string; size: number }): Promise<{ path?: string; token?: string; error?: string }> {
  const { company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  if (input.type !== "application/pdf") return { error: "Upload a PDF. (In Word or Google Docs: File › Download › PDF.)" };
  if (input.size > 20 * 1024 * 1024) return { error: "That file is too big (20 MB max)." };
  const path = `${company.id}/esign/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const { data, error } = await createAdminClient().storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start." };
  return { path, token: data.token };
}

const signerSchema = z.object({ name: z.string().trim().min(2, "Enter each signer's full name.").max(120), email: z.string().trim().email("Enter a valid e-mail for each signer.") });

/** Freeze the uploaded PDF (its fingerprint) and e-mail the first signer. */
export async function sendEsign(input: { path: string; title: string; leaseId: string | null; signers: { name: string; email: string }[] }): Promise<{ error?: string; message?: string }> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  if (!input.path.startsWith(`${company.id}/esign/`)) return { error: NOT_ALLOWED };
  const title = input.title.trim();
  if (title.length < 2 || title.length > 200) return { error: "Give the document a name, like Pet addendum." };
  const signers = z.array(signerSchema).min(1, "Add at least one signer.").max(6, "Six signers at most.").safeParse(input.signers.filter((s) => s.name.trim() || s.email.trim()));
  if (!signers.success) return { error: signers.error.issues[0].message };
  let leaseId: string | null = null;
  if (input.leaseId) {
    const { data: lease } = await supabase.from("lease").select("id").eq("id", input.leaseId).eq("company_id", company.id).maybeSingle();
    if (!lease) return { error: "That lease wasn't found." };
    leaseId = lease.id;
  }
  const { data: file } = await createAdminClient().storage.from("documents").download(input.path);
  if (!file) return { error: "The upload didn't arrive. Please try again." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return { error: "That file isn't a PDF." };
  const { data: req, error } = await supabase
    .from("signature_request")
    .insert({ company_id: company.id, lease_id: leaseId, title, snapshot: [], snapshot_sha256: sha256Bytes(bytes), source_path: input.path, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await supabase.from("signature_signer").insert(signers.data.map((s, i) => ({ company_id: company.id, request_id: req.id, role: "signer", name: s.name, email: s.email, sign_order: i + 1 })));
  await supabase.from("signature_event").insert({ company_id: company.id, request_id: req.id, kind: "created" });
  const sent = await inviteNextSigner(company, req.id);
  revalidatePath("/e-sign");
  return sent.ok ? { message: `Sent to ${sent.to}. The next signer gets their link after they sign.` } : { error: "Saved, but the e-mail didn't send. Void it and try again." };
}

/** Cancel an unsigned request. */
export async function voidEsign(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const { data: req } = await supabase.from("signature_request").select("id, status, source_path").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  // Lease and management agreement requests are voided from their own pages.
  if (!req || req.status !== "sent" || !req.source_path) return;
  await supabase.from("signature_request").update({ status: "voided" }).eq("id", req.id);
  await supabase.from("signature_signer").update({ token_hash: null }).eq("request_id", req.id);
  await supabase.from("signature_event").insert({ company_id: company.id, request_id: req.id, kind: "voided" });
  revalidatePath("/e-sign");
}
