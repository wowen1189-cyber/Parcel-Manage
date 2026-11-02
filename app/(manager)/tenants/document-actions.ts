"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENT_CATEGORIES } from "./document-labels";

// Office uploads to a tenant's documents (signed lease from elsewhere, move-in photos, IDs the tenant
// gave, correspondence). Files go straight to private storage with a one-time link; then they're filed.

const EDIT_ROLES = ["admin", "property_manager", "leasing_agent"];
const TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export async function startTenantDocument(input: { leaseId: string; type: string; size: number }): Promise<{ path?: string; token?: string; error?: string }> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: "Your role can't add tenant documents." };
  const ext = TYPES[input.type];
  if (!ext) return { error: "Upload a PDF, Word file, or JPG, PNG or WebP photo." };
  if (input.size > 20 * 1024 * 1024) return { error: "That file is too big (20 MB max)." };
  const { data: lease } = await supabase.from("lease").select("id").eq("id", input.leaseId).eq("company_id", company.id).maybeSingle();
  if (!lease) return { error: "Lease not found." };
  const path = `${company.id}/leases/${lease.id}/${Date.now()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start." };
  return { path, token: data.token };
}

export async function finishTenantDocument(input: { leaseId: string; path: string; fileName: string; category: string }): Promise<{ error?: string }> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role) || !input.path.startsWith(`${company.id}/leases/${input.leaseId}/`)) return { error: "Your role can't add tenant documents." };
  const category = z.enum(Object.keys(DOCUMENT_CATEGORIES) as [string, ...string[]]).catch("other").parse(input.category);
  const { data: lease } = await supabase.from("lease").select("id, unit(property_id)").eq("id", input.leaseId).eq("company_id", company.id).maybeSingle();
  if (!lease) return { error: "Lease not found." };
  const { error } = await supabase.from("document").insert({
    company_id: company.id,
    storage_path: input.path,
    file_name: input.fileName.slice(0, 200) || "Document",
    category,
    source: "upload",
    lease_id: lease.id,
    property_id: lease.unit?.property_id ?? null,
    uploaded_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/tenants/${lease.id}`);
  return {};
}
