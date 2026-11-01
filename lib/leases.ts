// Lease terms shown on screens and exports.

import type { BusinessRules } from "@/lib/business-rules";
import { daysBetween, money } from "@/lib/format";

export type LateFeeFields = {
  late_fee_grace_days: number | null;
  late_fee_flat_cents: number | null;
  late_fee_pct: number | string | null;
  late_fee_basis?: string | null;
  late_fee_daily_cents?: number | null;
  late_fee_daily_max_cents?: number | null;
};

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/**
 * The late fee this lease charges. A lease's own terms win; otherwise the company's business rules apply.
 * Residential late fees are only collectible when the written lease states them (Fla. Stat. ch. 83 Part II
 * sets no amount; 83.43 lets the lease call them rent), so the screen shows where each figure comes from.
 */
export function lateFeeText(lease: LateFeeFields, rules: BusinessRules): { text: string; source: "lease" | "company" } {
  const pct = lease.late_fee_pct == null ? null : Number(lease.late_fee_pct);
  if (lease.late_fee_grace_days != null && (lease.late_fee_flat_cents != null || pct != null)) {
    const amount = pct != null ? `${pct}% of ${lease.late_fee_basis === "all_charges" ? "all charges" : "rent"}` : money(lease.late_fee_flat_cents);
    const daily = lease.late_fee_daily_cents
      ? `, then ${money(lease.late_fee_daily_cents)} a day${lease.late_fee_daily_max_cents ? ` up to ${money(lease.late_fee_daily_max_cents)}` : ""}`
      : "";
    return { text: `${amount} if unpaid after the ${ordinal(lease.late_fee_grace_days)}${daily}`, source: "lease" };
  }
  return { text: `${money(rules.rent.lateFeeCents)} on the ${ordinal(rules.rent.lateFeeDay)}`, source: "company" };
}

export type LeaseDates = { status: string; end_date: string | null; move_out_on: string | null };

/** "Month-to-month", "Ends in 45 days", "Moving out Nov 30"… with a tone for the pill. */
export function leaseTiming(l: LeaseDates, today: string): { label: string; tone: "success" | "warn" | "danger" | "info" | "neutral"; daysLeft: number | null } {
  if (l.status === "notice") return { label: "On notice", tone: "warn", daysLeft: l.move_out_on ? daysBetween(today, l.move_out_on) : null };
  if (!l.end_date) return { label: "Month-to-month", tone: "info", daysLeft: null };
  const days = daysBetween(today, l.end_date);
  if (days < 0) return { label: "Past end date", tone: "danger", daysLeft: days };
  if (days <= 90) return { label: `Ends in ${days} days`, tone: "warn", daysLeft: days };
  return { label: "Active", tone: "success", daysLeft: days };
}
