"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { documentToText } from "@/lib/documents/text";
import { inviteNextSigner, sha256 } from "@/lib/esign";
import { contactName } from "@/lib/format";
import { leaseDocuments } from "@/lib/lease-documents";
import { requireCompany } from "@/lib/session";

export type EsignState = { error?: string; message?: string };
const ROLES = ["admin", "property_manager", "leasing_agent"];

/**
 * Send the lease and its disclosures for e-signature: freeze the filled text, then tenants sign in order,
 * then any guarantor, then you (the landlord's agent). Blanks must be filled first.
 */
export async function sendForSignature(_: EsignState, form: FormData): Promise<EsignState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't send leases for signature." };
  const leaseId = z.string().uuid().safeParse(form.get("lease_id"));
  if (!leaseId.success) return { error: "Lease not found." };
  const { data: open } = await supabase.from("signature_request").select("id").eq("lease_id", leaseId.data).eq("status", "sent").limit(1);
  if (open?.length) return { error: "This lease is already out for signature. Void that request to send a new one." };
  const found = await leaseDocuments(supabase, company, leaseId.data);
  if (!found) return { error: "Lease not found." };
  const blanks = found.docs.flatMap((d) => d.blanks.map((b) => `${d.template.title}: ${b}`));
  if (blanks.length) return { error: `Fill these in first: ${blanks.slice(0, 6).join("; ")}${blanks.length > 6 ? ` and ${blanks.length - 6} more` : ""}.` };
  const people = [...found.lease.lease_tenant].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const tenants = people.filter((p) => p.role === "tenant");
  const guarantors = people.filter((p) => p.role === "guarantor");
  const missing = [...tenants, ...guarantors].filter((p) => !p.contact.email);
  if (missing.length) return { error: `Add an e-mail for ${missing.map((p) => contactName(p.contact)).join(", ")} first.` };
  const { data: me } = await supabase.from("profile").select("full_name, email").eq("id", user.id).single();
  const snapshot = found.docs.map((d) => documentToText(d.template, d.values, d.conditions));
  const title = found.commercial ? `Commercial lease for ${found.lease.unit.property.name}` : `Lease and disclosures for ${found.lease.unit.property.name}${found.lease.unit.label !== "Home" ? ` ${found.lease.unit.label}` : ""}`;
  const { data: req, error } = await supabase
    .from("signature_request")
    .insert({ company_id: company.id, lease_id: leaseId.data, title, snapshot: snapshot as never, snapshot_sha256: sha256(JSON.stringify(snapshot)), created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const signers = [
    ...tenants.map((p, i) => ({ role: "tenant", name: contactName(p.contact), email: p.contact.email!.split(/[,;]/)[0].trim(), sign_order: i + 1 })),
    ...guarantors.map((p, i) => ({ role: "guarantor", name: contactName(p.contact), email: p.contact.email!.split(/[,;]/)[0].trim(), sign_order: tenants.length + i + 1 })),
    { role: "agent", name: me?.full_name ?? company.name, email: me?.email ?? company.office_email ?? "", sign_order: tenants.length + guarantors.length + 1 },
  ];
  await supabase.from("signature_signer").insert(signers.map((s) => ({ ...s, company_id: company.id, request_id: req.id })));
  await supabase.from("signature_event").insert({ company_id: company.id, request_id: req.id, kind: "created" });
  if (found.lease.status === "draft") await supabase.from("lease").update({ status: "pending_signature" }).eq("id", leaseId.data);
  const sent = await inviteNextSigner(company, req.id);
  revalidatePath(`/tenants/${leaseId.data}`);
  revalidatePath(`/tenants/${leaseId.data}/lease`);
  return sent.ok ? { message: `Sent to ${sent.to}. Each signer gets their link after the one before signs; you sign last.` } : { error: "Saved, but the e-mail didn't send." };
}

export async function voidSignatureRequest(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("request_id"));
  if (!id.success) return;
  const { data: req } = await supabase.from("signature_request").select("id, lease_id, status").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!req || req.status !== "sent") return;
  await supabase.from("signature_request").update({ status: "voided" }).eq("id", req.id);
  await supabase.from("signature_signer").update({ token_hash: null }).eq("request_id", req.id);
  await supabase.from("signature_event").insert({ company_id: company.id, request_id: req.id, kind: "voided" });
  if (req.lease_id) {
    await supabase.from("lease").update({ status: "draft" }).eq("id", req.lease_id).eq("status", "pending_signature");
    revalidatePath(`/tenants/${req.lease_id}`);
  }
}
