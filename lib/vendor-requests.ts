// Vendor paperwork requests: which documents to ask a vendor for, the private upload link, and the
// reminder schedule. A vendor who works on site needs a W-9 and a current liability insurance
// certificate before work orders (lib/vendors.ts); every 1099 vendor needs a W-9 before it can be paid
// (IRS backup-withholding rules, 26 U.S.C. 3406). Reminders go out until everything is in.

import { createHash, randomBytes } from "node:crypto";
import { daysBetween } from "@/lib/format";
import { EXPIRING_SOON_DAYS, isOnSite, type VendorPaperwork } from "@/lib/vendors";

export type RequestItem = "w9" | "coi" | "workers_comp";

export const REQUEST_ITEM: Record<RequestItem, { label: string; detail: string; needsExpiry: boolean; optional?: boolean }> = {
  w9: { label: "W-9", detail: "IRS Form W-9, signed, with your legal name and tax ID.", needsExpiry: false },
  coi: { label: "Liability insurance certificate", detail: "Certificate of insurance (COI) for general liability, showing the policy end date.", needsExpiry: true },
  workers_comp: {
    label: "Workers' comp certificate or exemption",
    detail: "Your workers' compensation certificate, or your Florida exemption certificate if you're exempt.",
    needsExpiry: true,
    optional: true,
  },
};

/** Days between reminders, and when to stop (about three months). */
export const REMINDER_EVERY_DAYS = 3;
export const MAX_SENDS = 30;

type VendorForRequest = VendorPaperwork & { is_1099: boolean };

/** What to ask this vendor for, given what's on file today. */
export function itemsNeeded(v: VendorForRequest, today: string): RequestItem[] {
  const items: RequestItem[] = [];
  if (!v.w9_on_file) items.push("w9");
  if (isOnSite(v.trade)) {
    if (!v.coi_expires_on || daysBetween(today, v.coi_expires_on) <= EXPIRING_SOON_DAYS) items.push("coi");
    if (!v.workers_comp_expires_on || daysBetween(today, v.workers_comp_expires_on) <= EXPIRING_SOON_DAYS) items.push("workers_comp");
  }
  return items;
}

/** Items that must be in before the request is complete (optional ones don't hold it open). */
export function requiredItems(items: RequestItem[]): RequestItem[] {
  return items.filter((i) => !REQUEST_ITEM[i].optional);
}

/** A 1099 vendor without a W-9 can't be paid. */
export function canPay(v: { w9_on_file: boolean; is_1099: boolean }): boolean {
  return v.w9_on_file || !v.is_1099;
}

/** Is a reminder due for an open request? */
export function reminderDue(r: { last_sent_at: string; send_count: number; completed_at: string | null; cancelled_at: string | null }, now: Date): boolean {
  if (r.completed_at || r.cancelled_at || r.send_count >= MAX_SENDS) return false;
  return now.getTime() - new Date(r.last_sent_at).getTime() >= REMINDER_EVERY_DAYS * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;
}

/** A new private link token and the hash stored in the database. The token itself is only in the e-mail. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
