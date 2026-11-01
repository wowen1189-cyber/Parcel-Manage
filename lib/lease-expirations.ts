// Lease expiration management: spread lease endings across the year so no month has too many move-outs,
// and recommend the lease length (new leases and renewals) that keeps it that way.
//
// Rules (company settings, see lib/business-rules.ts):
// - Cap: at most `maxSharePercent` of units may end in one calendar month, for the whole portfolio and for
//   each property (every property may always have at least 1).
// - Avoid months: endings in slow re-leasing months (SIM REI: Nov, Dec, Jan) are allowed but discouraged.
// - Lengths: any whole number of months from minTermMonths to maxTermMonths (Fla. Stat. ch. 83 sets no maximum).
//   A lease ends on the last day of the month, like SIM REI's leases (a lease starting Jul 15 for 12 months
//   ends Jul 31 next year).
// - Preference: 12 months, then whichever end month is lightest. Short terms carry the short-term surcharge.

import { MONTH_NAMES, type BusinessRules } from "@/lib/business-rules";

export type LeaseEnd = { leaseId: string; propertyId: string; endDate: string | null; status: string; moveOutOn: string | null };

/** "2027-07" for a date. */
export const monthOf = (iso: string) => iso.slice(0, 7);

/** The month a lease frees up the unit: move-out month for leases on notice, end month otherwise. Null for month-to-month. */
export function expirationMonth(l: Pick<LeaseEnd, "endDate" | "status" | "moveOutOn">): string | null {
  if (l.status === "notice" && l.moveOutOn) return monthOf(l.moveOutOn);
  return l.endDate ? monthOf(l.endDate) : null;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return `${month}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * End date for a lease of `months` starting on `start`: the last day of the month that contains
 * (start + months − 1 day). Starting on the 1st gives exactly `months`; mid-month starts run to month end.
 */
export function leaseEndDate(start: string, months: number): string {
  // Starting on the 1st, the last full month is month (months − 1); any later start runs into month (months).
  const day = Number(start.slice(8, 10));
  return lastDayOf(addMonths(monthOf(start), day === 1 ? months - 1 : months));
}

export function monthLabel(month: string, style: "short" | "long" = "short"): string {
  const [y, m] = month.split("-").map(Number);
  const name = MONTH_NAMES[m - 1];
  return style === "long" ? `${name} ${y}` : `${name.slice(0, 3)} ${String(y).slice(2)}`;
}

/** Most leases that may end in one month for a group of `units` units. */
export function monthlyCap(units: number, sharePercent: number): number {
  return Math.max(1, Math.floor((units * sharePercent) / 100 + 1e-9));
}

export type Counts = { portfolio: Map<string, number>; byProperty: Map<string, Map<string, number>> };

export function countExpirations(leases: LeaseEnd[], excludeLeaseId?: string): Counts {
  const portfolio = new Map<string, number>();
  const byProperty = new Map<string, Map<string, number>>();
  for (const l of leases) {
    if (l.leaseId === excludeLeaseId) continue;
    const month = expirationMonth(l);
    if (!month) continue;
    portfolio.set(month, (portfolio.get(month) ?? 0) + 1);
    const p = byProperty.get(l.propertyId) ?? new Map<string, number>();
    p.set(month, (p.get(month) ?? 0) + 1);
    byProperty.set(l.propertyId, p);
  }
  return { portfolio, byProperty };
}

export type TermOption = {
  months: number;
  endDate: string;
  endMonth: string;
  /** Leases already ending that month (portfolio / this property), not counting this one. */
  portfolioLoad: number;
  propertyLoad: number;
  portfolioCap: number;
  propertyCap: number;
  status: "good" | "avoid" | "full";
  reasons: string[];
  /** Monthly short-term surcharge for this length (0 if none). */
  surchargeCents: number;
  score: number;
  recommended: boolean;
};

export function recommendTerms(input: {
  start: string;
  propertyId: string;
  propertyUnits: number;
  portfolioUnits: number;
  counts: Counts;
  rules: BusinessRules;
}): TermOption[] {
  const { start, propertyId, propertyUnits, portfolioUnits, counts, rules } = input;
  const share = rules.expirations.maxSharePercent;
  const portfolioCap = monthlyCap(portfolioUnits, share);
  const propertyCap = monthlyCap(propertyUnits, share);
  const avoid = new Set<string>(rules.expirations.avoidMonths);
  const options: TermOption[] = [];

  for (let months = rules.lease.minTermMonths; months <= rules.lease.maxTermMonths; months++) {
    const endDate = leaseEndDate(start, months);
    const endMonth = monthOf(endDate);
    const portfolioLoad = counts.portfolio.get(endMonth) ?? 0;
    const propertyLoad = counts.byProperty.get(propertyId)?.get(endMonth) ?? 0;
    const monthName = MONTH_NAMES[Number(endMonth.slice(5)) - 1];
    const reasons: string[] = [];
    if (propertyLoad + 1 > propertyCap) reasons.push(`${propertyLoad} lease${propertyLoad === 1 ? "" : "s"} at this property already end then (limit ${propertyCap})`);
    if (portfolioLoad + 1 > portfolioCap) reasons.push(`${portfolioLoad} leases already end then across all properties (limit ${portfolioCap})`);
    const full = reasons.length > 0;
    if (avoid.has(monthName)) reasons.push(`${monthName} is a slow month to re-lease`);
    const status: TermOption["status"] = full ? "full" : avoid.has(monthName) ? "avoid" : "good";
    const surchargeCents = months < rules.lease.shortTermUnderMonths ? rules.lease.shortTermSurchargeCents : 0;
    // Lower is better: rule breaks first, then how busy the month already is, then distance from a 12-month lease.
    const score =
      (full ? 1000 : 0) +
      (status === "avoid" ? 300 : 0) +
      ((portfolioLoad + 1) / portfolioCap) * 40 +
      ((propertyLoad + 1) / propertyCap) * 40 +
      Math.abs(months - 12) * 6;
    options.push({ months, endDate, endMonth, portfolioLoad, propertyLoad, portfolioCap, propertyCap, status, reasons, surchargeCents, score, recommended: false });
  }

  const best = [...options].sort((a, b) => a.score - b.score)[0];
  if (best) best.recommended = true;
  return options;
}

export type MonthCell = { month: string; count: number; cap: number; over: boolean; avoid: boolean };

/** Lease endings per month for the next `horizon` months, for a group of units. */
export function calendar(counts: Map<string, number> | undefined, units: number, fromMonth: string, horizon: number, rules: BusinessRules): MonthCell[] {
  const cap = monthlyCap(units, rules.expirations.maxSharePercent);
  const avoid = new Set<string>(rules.expirations.avoidMonths);
  return Array.from({ length: horizon }, (_, i) => {
    const month = addMonths(fromMonth, i);
    const count = counts?.get(month) ?? 0;
    return { month, count, cap, over: count > cap, avoid: avoid.has(MONTH_NAMES[Number(month.slice(5)) - 1]) };
  });
}
