// Vendor paperwork rules: who can be sent to a unit.
// On-site trades need a W-9 and a current certificate of insurance (COI). Utilities, suppliers and
// professionals (legal, bookkeeping) never come on site, so they're exempt.

import { ON_SITE_TRADES, type VendorTrade } from "@/lib/import/appfolio";
import { daysBetween } from "@/lib/format";

export const VENDOR_TRADES: VendorTrade[] = [
  ...ON_SITE_TRADES,
  "Legal", "Bookkeeping", "Marketing & media", "Insurance financing", "Utility", "Supplies", "Government", "Other",
];

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  ach: "ACH (eCheck)",
  check: "Check",
  mailed_check: "Mailed check",
  card: "Card",
  other: "Other",
};

export const EXPIRING_SOON_DAYS = 30;

export type VendorPaperwork = {
  trade: string | null;
  w9_on_file: boolean;
  coi_expires_on: string | null;
  workers_comp_expires_on: string | null;
  dispatch_override: boolean;
};

export type Compliance = {
  /** not_required: never on site. ok: all set. expiring: set but something ends within 30 days. blocked: missing or expired. */
  status: "not_required" | "ok" | "expiring" | "blocked";
  issues: string[];
  canDispatch: boolean;
};

export function isOnSite(trade: string | null): boolean {
  // An unknown trade ("Other", blank) is treated as on-site: safer to ask for paperwork.
  return !trade || trade === "Other" || (ON_SITE_TRADES as string[]).includes(trade);
}

export function vendorCompliance(v: VendorPaperwork, today: string): Compliance {
  if (!isOnSite(v.trade)) return { status: "not_required", issues: [], canDispatch: true };

  const blocking: string[] = [];
  const expiring: string[] = [];
  if (!v.w9_on_file) blocking.push("No W-9 on file");
  if (!v.coi_expires_on) blocking.push("No insurance certificate");
  else {
    const days = daysBetween(today, v.coi_expires_on);
    if (days < 0) blocking.push("Insurance expired");
    else if (days <= EXPIRING_SOON_DAYS) expiring.push(`Insurance ends in ${days} day${days === 1 ? "" : "s"}`);
  }
  if (v.workers_comp_expires_on) {
    const days = daysBetween(today, v.workers_comp_expires_on);
    if (days < 0) blocking.push("Workers' comp expired");
    else if (days <= EXPIRING_SOON_DAYS) expiring.push(`Workers' comp ends in ${days} day${days === 1 ? "" : "s"}`);
  }

  const issues = [...blocking, ...expiring];
  if (blocking.length) return { status: "blocked", issues, canDispatch: v.dispatch_override };
  return { status: expiring.length ? "expiring" : "ok", issues, canDispatch: true };
}
