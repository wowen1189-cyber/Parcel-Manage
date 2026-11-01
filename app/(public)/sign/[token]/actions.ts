"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { completeRequest, inviteNextSigner } from "@/lib/esign";
import { getRequestSubdomain } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/vendor-requests";

export type SignState = { error?: string; done?: "signed" | "declined" };

async function findSigner(token: string) {
  const db = createAdminClient();
  const subdomain = await getRequestSubdomain();
  const { data: s } = await db
    .from("signature_signer")
    .select("id, company_id, request_id, name, status, signature_request!inner(id, status, company(id, name, legal_name, subdomain, office_email, office_phone, time_zone))")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!s || s.signature_request.status !== "sent" || s.signature_request.company.subdomain !== subdomain || s.status === "signed" || s.status === "declined") return null;
  return { db, s };
}

/** Sign: consent, typed name and initials, recorded with time, IP address and device. */
export async function sign(_: SignState, form: FormData): Promise<SignState> {
  const p = z
    .object({ token: z.string().min(20), consent: z.literal("on", { message: "Check the box to agree to sign electronically." }), typed: z.string().trim().min(2, "Type your full name to sign.").max(120), initials: z.string().trim().min(1, "Type your initials.").max(6) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const found = await findSigner(p.data.token);
  if (!found) return { error: "This link no longer works. Contact the office." };
  const { db, s } = found;
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
  if (norm(p.data.typed) !== norm(s.name)) return { error: `Type your name exactly as it appears on the lease: ${s.name}.` };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const ua = h.get("user-agent");
  const now = new Date().toISOString();
  await db.from("signature_signer").update({ status: "signed", consented_at: now, signed_at: now, typed_signature: p.data.typed, initials: p.data.initials, ip, user_agent: ua, token_hash: null }).eq("id", s.id);
  await db.from("signature_event").insert([
    { company_id: s.company_id, request_id: s.request_id, signer_id: s.id, kind: "consented", ip, user_agent: ua },
    { company_id: s.company_id, request_id: s.request_id, signer_id: s.id, kind: "signed", ip, user_agent: ua },
  ]);
  const company = s.signature_request.company;
  const { data: left } = await db.from("signature_signer").select("id").eq("request_id", s.request_id).neq("status", "signed");
  if (left?.length) await inviteNextSigner(company, s.request_id);
  else await completeRequest(company, s.request_id);
  return { done: "signed" };
}

export async function decline(_: SignState, form: FormData): Promise<SignState> {
  const found = await findSigner(String(form.get("token")));
  if (!found) return { error: "This link no longer works." };
  const { db, s } = found;
  const h = await headers();
  await db.from("signature_signer").update({ status: "declined", token_hash: null }).eq("id", s.id);
  await db.from("signature_event").insert({ company_id: s.company_id, request_id: s.request_id, signer_id: s.id, kind: "declined", ip: h.get("x-forwarded-for")?.split(",")[0] ?? null, user_agent: h.get("user-agent") });
  return { done: "declined" };
}
