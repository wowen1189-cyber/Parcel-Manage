"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailHtml, emailText } from "@/lib/email/layout";
import { contactName, todayIn } from "@/lib/format";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestSubdomain } from "@/lib/session";
import { hashToken, itemsNeeded, MAX_UPLOAD_BYTES, REQUEST_ITEM, requiredItems, UPLOAD_TYPES, type RequestItem } from "@/lib/vendor-requests";

export type UploadState = { error?: string; message?: string };

// Public actions behind the private upload link: the token is the only credential, so every lookup is by
// the token's hash and is scoped to that request's company and vendor (service role, CLAUDE.md rule 1).
// Files go straight to private storage with a one-time signed upload URL (no size limit from the app server).

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/webp": "webp" };

async function findRequest(token: string) {
  const db = createAdminClient();
  const subdomain = await getRequestSubdomain();
  const { data: req } = await db
    .from("vendor_request")
    .select("id, company_id, vendor_id, completed_at, cancelled_at, company(id, name, subdomain, office_email, time_zone)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!req || req.cancelled_at || req.company.subdomain !== subdomain) return null;
  return { db, req };
}

const LINK_DEAD = "This link no longer works. Use the newest e-mail we sent you.";

/** Step 1: check the file and hand back a one-time upload URL into this vendor's folder. */
export async function startVendorUpload(input: { token: string; item: string; type: string; size: number }): Promise<{ path?: string; uploadToken?: string; error?: string }> {
  const item = z.enum(["w9", "coi", "workers_comp"]).safeParse(input.item);
  if (!item.success || typeof input.token !== "string") return { error: "Something went wrong. Please reload the page." };
  if (!input.size) return { error: "Choose a file to upload." };
  if (input.size > MAX_UPLOAD_BYTES) return { error: "That file is too big. Upload a PDF or photo under 15 MB." };
  if (!UPLOAD_TYPES.includes(input.type)) return { error: "Upload a PDF or a photo (JPG, PNG or HEIC)." };
  const found = await findRequest(input.token);
  if (!found) return { error: LINK_DEAD };
  const path = `${found.req.company_id}/vendors/${found.req.vendor_id}/${item.data}-${Date.now()}.${EXT[input.type] ?? "bin"}`;
  const { data, error } = await found.db.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start. Please try again." };
  return { path, uploadToken: data.token };
}

/** Step 2: the file is in storage; record it and update the vendor's paperwork. */
export async function finishVendorUpload(_: UploadState, form: FormData): Promise<UploadState> {
  const parsed = z
    .object({
      token: z.string().min(20).max(100),
      item: z.enum(["w9", "coi", "workers_comp"]),
      path: z.string().min(10).max(300),
      expires_on: z.string().optional(),
    })
    .safeParse({ token: form.get("token"), item: form.get("item"), path: form.get("path"), expires_on: form.get("expires_on") ?? undefined });
  if (!parsed.success) return { error: "Choose a file to upload." };
  const { token, item, path } = parsed.data;
  const found = await findRequest(token);
  if (!found) return { error: LINK_DEAD };
  const { db, req } = found;
  // The path must be one this request handed out, in this vendor's folder.
  const folder = `${req.company_id}/vendors/${req.vendor_id}/`;
  const name = path.slice(folder.length);
  if (!path.startsWith(folder) || !new RegExp(`^${item}-\\d+\\.[a-z]+$`).test(name)) return { error: "Something went wrong. Please reload the page." };
  const { data: listed } = await db.storage.from("documents").list(folder.slice(0, -1), { search: name });
  if (!listed?.some((o) => o.name === name)) return { error: "The file didn't finish uploading. Please try again." };

  const today = todayIn(req.company.time_zone);
  let expires: string | null = null;
  if (REQUEST_ITEM[item as RequestItem].needsExpiry) {
    const d = parsed.data.expires_on ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "Enter the date the policy ends." };
    if (d < today) return { error: "That policy has already ended. Upload your current certificate." };
    expires = d;
  }
  const ext = name.split(".").pop();

  const { data: vendor } = await db.from("vendor").select("id, contact_id, trade, is_1099, w9_on_file, coi_expires_on, workers_comp_expires_on, dispatch_override, contact(kind, first_name, last_name, business_name)").eq("id", req.vendor_id).eq("company_id", req.company_id).single();
  if (!vendor) return { error: "This link no longer works. Use the newest e-mail we sent you." };
  await db.from("document").insert({
    company_id: req.company_id,
    vendor_id: req.vendor_id,
    contact_id: vendor.contact_id,
    storage_path: path,
    file_name: `${REQUEST_ITEM[item as RequestItem].label}.${ext}`,
    category: item === "w9" ? "tax" : "insurance",
    source: "vendor portal",
    expires_on: expires,
  });
  const update =
    item === "w9" ? { w9_on_file: true, w9_received_on: today } : item === "coi" ? { coi_expires_on: expires } : { workers_comp_expires_on: expires };
  await db.from("vendor").update(update).eq("id", req.vendor_id).eq("company_id", req.company_id);

  // All required documents in: close the request and tell the office.
  const after = { ...vendor, ...update };
  const stillNeeded = requiredItems(itemsNeeded(after, today));
  if (!stillNeeded.length && !req.completed_at) {
    await db.from("vendor_request").update({ completed_at: new Date().toISOString() }).eq("id", req.id);
    if (req.company.office_email) {
      const name = contactName(vendor.contact);
      const content = {
        preheader: `${name} uploaded their paperwork.`,
        heading: "Vendor paperwork received",
        paragraphs: [`<strong>${escapeHtml(name)}</strong> uploaded their W-9 and insurance through their link. They can now be sent work orders and paid.`, "Their documents are on their vendor page."],
        fromLine: req.company.name,
      };
      await sendEmail({ to: req.company.office_email, subject: `${name} sent their W-9 and insurance`, html: emailHtml(content), text: emailText(content), fromName: "Parcel Manage" });
    }
  }
  revalidatePath(`/vendor/setup/${token}`);
  return { message: stillNeeded.length ? "Got it, thank you." : "Got it, thank you. You're all set." };
}
