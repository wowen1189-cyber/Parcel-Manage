import "server-only";
import { createHash } from "node:crypto";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import type { DocText } from "@/lib/documents/text";
import { appendCertificate, documentPdf } from "@/lib/document-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyUrl } from "@/lib/tenant";
import { newToken } from "@/lib/vendor-requests";

// E-signature (ch. 668, Florida Electronic Signature Act and UETA; federal E-SIGN): frozen documents,
// signers in order, consent, typed signatures, a full audit trail, and a signed PDF filed on the lease (or,
// for a management agreement, on the owner).

export const CONSENT_TEXT =
  "I agree to sign these documents electronically. My typed name is my signature and has the same effect as a handwritten signature (Florida Electronic Signature Act, chapter 668, Florida Statutes; federal E-SIGN Act). I can ask for a paper copy at no cost, and I can withdraw this consent by contacting the sender before I sign.";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const sha256Bytes = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

type Company = { id: string; name: string; subdomain: string | null; office_email: string | null; office_phone: string | null };

/** Send the next signer their link (a fresh token each time). */
export async function inviteNextSigner(company: Company, requestId: string): Promise<{ ok: boolean; to?: string }> {
  const db = createAdminClient();
  const { data: req } = await db.from("signature_request").select("id, title, signature_signer(id, sign_order, name, email, status)").eq("id", requestId).eq("company_id", company.id).single();
  const next = [...(req?.signature_signer ?? [])].sort((a, b) => a.sign_order - b.sign_order).find((s) => s.status !== "signed");
  if (!req || !next || !company.subdomain) return { ok: false };
  const { token, hash } = newToken();
  await db.from("signature_signer").update({ token_hash: hash, status: next.status === "viewed" ? "viewed" : "sent" }).eq("id", next.id);
  await db.from("signature_event").insert({ company_id: company.id, request_id: req.id, signer_id: next.id, kind: "sent" });
  const url = companyUrl(company.subdomain, ROOT_DOMAIN, `/sign/${token}`);
  const content = {
    preheader: `${company.name} sent you ${req.title} to sign.`,
    heading: "Please review and sign",
    paragraphs: [`Hi ${escapeHtml(next.name)},`, `${escapeHtml(company.name)} sent you <strong>${escapeHtml(req.title)}</strong> to review and sign online. It takes a few minutes; read it all before you sign.`],
    button: { label: "Review and sign", url },
    note: "This link is just for you. Don't forward it.",
    fromLine: company.name,
    footer: [company.name, company.office_phone].filter(Boolean).join(" · "),
  };
  const ok = await sendEmail({ to: next.email, subject: `Please sign: ${req.title}`, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
  return { ok, to: next.email };
}

/** Everyone signed: build the signed PDF with its certificate, file it, and send everyone a copy. */
export async function completeRequest(company: Company & { legal_name?: string | null; time_zone: string }, requestId: string) {
  const db = createAdminClient();
  const { data: req } = await db.from("signature_request").select("id, lease_id, management_agreement_id, source_path, title, snapshot, snapshot_sha256, created_at, signature_signer(name, email, role, signed_at, typed_signature, initials, ip, user_agent, consented_at, sign_order)").eq("id", requestId).single();
  if (!req) return;
  const tz = company.time_zone;
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "long" }) : "");
  const signers = [...req.signature_signer].sort((a, b) => a.sign_order - b.sign_order);
  const certificate = {
    title: "Signature certificate",
    lines: [
      `Documents: ${req.title}`,
      `Sent: ${when(req.created_at)} by ${company.legal_name ?? company.name}`,
      req.source_path ? `Document fingerprint (SHA-256 of the PDF as sent): ${req.snapshot_sha256}` : `Document fingerprint (SHA-256 of the frozen text): ${req.snapshot_sha256}`,
      "",
      ...signers.flatMap((s) => [
        `${s.role === "agent" ? (req.management_agreement_id ? "Agent (broker)" : "Landlord's agent") : s.role === "owner" ? "Owner" : s.role === "guarantor" ? "Guarantor" : s.role === "signer" ? `Signer ${s.sign_order}` : "Tenant"}: ${s.name} <${s.email}>`,
        `  Consented to sign electronically: ${when(s.consented_at)}`,
        `  Signed: ${when(s.signed_at)} as "${s.typed_signature}"${s.initials ? `, initials "${s.initials}" on every page with initials` : ""}`,
        `  From: ${s.ip ?? "unknown"} · ${s.user_agent?.slice(0, 120) ?? ""}`,
        "",
      ]),
      `Consent statement shown to each signer: ${CONSENT_TEXT}`,
    ],
  };
  // An uploaded PDF keeps its own pages (fingerprint checked again first); built documents are drawn from text.
  let pdf: Uint8Array;
  if (req.source_path) {
    const { data: file } = await db.storage.from("documents").download(req.source_path);
    if (!file) return;
    const original = new Uint8Array(await file.arrayBuffer());
    if (sha256Bytes(original) !== req.snapshot_sha256) return;
    pdf = await appendCertificate(original, certificate);
  } else pdf = await documentPdf(req.snapshot as DocText[], certificate);
  const path = `${company.id}/signed/${req.id}.pdf`;
  await db.storage.from("documents").upload(path, pdf, { contentType: "application/pdf", upsert: true });
  const agreement = req.management_agreement_id
    ? (await db.from("management_agreement").select("id, entity_id").eq("id", req.management_agreement_id).single()).data
    : null;
  const { data: doc } = await db
    .from("document")
    .insert({ company_id: company.id, lease_id: req.lease_id, entity_id: agreement?.entity_id ?? null, management_agreement_id: agreement?.id ?? null, storage_path: path, file_name: `${req.title} (signed).pdf`, category: agreement ? "agreement" : req.source_path && !req.lease_id ? "other" : "lease", source: "e-sign" })
    .select("id")
    .single();
  await db.from("signature_request").update({ status: "completed", completed_at: new Date().toISOString(), signed_document_id: doc?.id ?? null }).eq("id", req.id);
  await db.from("signature_event").insert({ company_id: company.id, request_id: req.id, kind: "completed" });
  // A management agreement is in force once both sides sign.
  if (agreement) await db.from("management_agreement").update({ status: "signed", signed_at: new Date().toISOString() }).eq("id", agreement.id);
  // A draft lease becomes active once signed; the unit is occupied once the lease has started.
  if (req.lease_id && !req.source_path) {
    const { data: lease } = await db.from("lease").select("id, status, start_date, unit_id").eq("id", req.lease_id).single();
    if (lease?.status === "draft" || lease?.status === "pending_signature") {
      await db.from("lease").update({ status: "active", move_in_on: lease.start_date }).eq("id", lease.id);
      if (lease.start_date <= new Date().toISOString().slice(0, 10)) await db.from("unit").update({ status: "occupied" }).eq("id", lease.unit_id);
    }
  }
  const key = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_FROM_DOMAIN;
  if (key && domain) {
    const content = { preheader: `${req.title} is signed.`, heading: "Signed by everyone", paragraphs: [`<strong>${escapeHtml(req.title)}</strong> has been signed by everyone. Your copy, with the signature certificate, is attached.`], fromLine: company.name };
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${company.name} <no-reply@${domain}>`, to: signers.map((s) => s.email), reply_to: company.office_email ?? undefined, subject: `Signed: ${req.title}`, html: emailHtml(content), text: emailText(content), attachments: [{ filename: `${req.title} (signed).pdf`, content: Buffer.from(pdf).toString("base64") }] }),
    });
  }
}
