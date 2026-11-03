// Tenant ledgers and automatic billing rules: what rent and recurring charges post each month, when a
// late fee posts and how much, and the running balance. Money is integer cents; dates are YYYY-MM-DD.
//
// Florida: ch. 83 Part II sets no late-fee amount, but a late fee is collectible only if the signed lease
// provides for it (83.43 lets the lease call it rent). The policy here comes from the lease's own terms
// when it has them, otherwise the company's business rules (which match SIM REI's lease). Commercial
// leases use their commercial terms (ch. 83 Part I sets no amount either).

import type { BusinessRules } from "@/lib/business-rules";
import type { CommercialTerms } from "@/lib/commercial-terms";

export const CHARGE_TYPES: Record<string, string> = {
  rent: "Rent",
  late_fee: "Late fee",
  pet_rent: "Pet rent",
  pet_fee: "Pet fee",
  nsf_fee: "Returned payment fee",
  utility: "Utilities",
  cam: "CAM",
  move_out: "Move-out charge",
  false_emergency: "False emergency charge",
  opening_balance: "Opening balance",
  other: "Other",
};

export const PAYMENT_METHODS: Record<string, string> = {
  check: "Check",
  money_order: "Money order",
  cash: "Cash",
  ach: "Bank transfer (ACH)",
  card: "Card",
  other: "Other",
};

export type LateFeePolicy = {
  /** Day of the month the first late fee posts (rent unpaid at the start of this day). */
  postsOnDay: number;
  flatCents: number | null;
  percent: number | null;
  /** What a percent fee is taken of. */
  basis: "rent" | "balance";
  dailyCents: number;
  dailyMaxCents: number | null;
};

type LeaseLateTerms = {
  late_fee_grace_days: number | null;
  late_fee_flat_cents: number | null;
  late_fee_pct: number | null;
  late_fee_basis: string | null;
  late_fee_daily_cents: number | null;
  late_fee_daily_max_cents: number | null;
};

/** The late fee policy for one lease: its own terms, else the company's rules; commercial terms for commercial leases. */
export function lateFeePolicy(lease: LeaseLateTerms, rules: BusinessRules, commercial: CommercialTerms | null): LateFeePolicy | null {
  if (commercial) {
    if (!commercial.lateFeePercent) return null;
    return { postsOnDay: commercial.lateAfterDay + 1, flatCents: null, percent: commercial.lateFeePercent, basis: "balance", dailyCents: 0, dailyMaxCents: null };
  }
  if (lease.late_fee_grace_days != null && (lease.late_fee_flat_cents || lease.late_fee_pct)) {
    return {
      // Rent is due on the due day; "late after N days" means the fee posts the day after the grace period.
      postsOnDay: rules.rent.dueDay + lease.late_fee_grace_days + 1,
      flatCents: lease.late_fee_flat_cents,
      percent: lease.late_fee_pct ? Number(lease.late_fee_pct) : null,
      basis: lease.late_fee_basis === "all_charges" ? "balance" : "rent",
      dailyCents: lease.late_fee_daily_cents ?? 0,
      dailyMaxCents: lease.late_fee_daily_max_cents,
    };
  }
  if (!rules.rent.lateFeeCents) return null;
  const r = rules.rent;
  return { postsOnDay: r.lateFeeDay, flatCents: r.lateFeeCents, percent: null, basis: "rent", dailyCents: r.lateFeeDailyCents, dailyMaxCents: r.lateFeeDailyMaxCents || null };
}

/** The first late fee for the month. */
export function lateFeeAmount(p: LateFeePolicy, rentCents: number, balanceCents: number): number {
  if (p.flatCents) return p.flatCents;
  if (p.percent) return Math.round(((p.basis === "rent" ? rentCents : balanceCents) * p.percent) / 100);
  return 0;
}

/** Rent for a month, after any scheduled increase that has started by the first of that month. */
export function rentForMonth(l: { rent_cents: number; next_rent_increase_on: string | null; next_rent_cents: number | null }, monthStart: string): number {
  if (l.next_rent_increase_on && l.next_rent_cents != null && l.next_rent_increase_on <= monthStart) return l.next_rent_cents;
  return l.rent_cents;
}

/** Recurring charges active for a month. */
export function recurringForMonth<T extends { starts_on: string | null; ends_on: string | null }>(charges: T[], monthStart: string): T[] {
  return charges.filter((c) => (!c.starts_on || c.starts_on <= endOfMonth(monthStart)) && (!c.ends_on || c.ends_on >= monthStart));
}

/** Does the lease bill in this month? (Started on or before the month's end, not ended before it began.) */
export function leaseBillsInMonth(l: { start_date: string; end_date: string | null; move_out_on: string | null; status: string }, monthStart: string): boolean {
  if (!["active", "notice"].includes(l.status)) return false;
  if (l.start_date > endOfMonth(monthStart)) return false;
  const end = l.move_out_on ?? (l.status === "notice" ? l.end_date : null);
  return !end || end >= monthStart;
}

export function endOfMonth(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthStart.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export const monthLabelLong = (monthStart: string) => new Date(`${monthStart}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export type LedgerCharge = { id: string; charge_type: string; description: string; amount_cents: number; due_date: string; created_at: string };
export type LedgerPayment = { id: string; method: string; amount_cents: number; received_on: string; status: string; purpose: string; reference: string | null; returned_on: string | null; created_at: string };
export type LedgerRow = { id: string; kind: "charge" | "payment" | "returned" | "opening"; date: string; description: string; chargeCents: number; paymentCents: number; balanceCents: number; status?: string; entered?: string };

/**
 * The tenant ledger: opening balance (until it's posted as a charge), charges and rent payments, oldest
 * first, with a running balance. Deposits are not rent and show separately. A returned payment shows as
 * received and then reversed.
 */
export function buildLedger(charges: LedgerCharge[], payments: LedgerPayment[], opening: { cents: number | null; asOf: string | null }): { rows: LedgerRow[]; balanceCents: number } {
  const items: Omit<LedgerRow, "balanceCents">[] = [];
  const openingPosted = charges.some((c) => c.charge_type === "opening_balance");
  if (!openingPosted && opening.cents) items.push({ id: "opening", kind: "opening", date: opening.asOf ?? "1900-01-01", description: "Balance carried over from the old software", chargeCents: Math.max(opening.cents, 0), paymentCents: Math.max(-opening.cents, 0) });
  for (const c of charges) items.push({ id: c.id, kind: "charge", date: c.due_date, description: c.description, chargeCents: c.amount_cents, paymentCents: 0, entered: c.created_at });
  for (const p of payments.filter((x) => x.purpose === "rent" && x.status !== "failed" && x.status !== "pending")) {
    const label = `${PAYMENT_METHODS[p.method] ?? "Payment"}${p.reference ? ` ${p.reference}` : ""}`;
    items.push({ id: p.id, kind: "payment", date: p.received_on, description: `Payment: ${label}`, chargeCents: 0, paymentCents: p.amount_cents, status: p.status, entered: p.created_at });
    if (p.status === "returned") items.push({ id: `${p.id}-r`, kind: "returned", date: p.returned_on ?? p.received_on, description: `Returned: ${label}`, chargeCents: p.amount_cents, paymentCents: 0, entered: `${p.created_at}~` });
  }
  // Same day: the carried-over balance first, then in the order things were entered (a returned payment
  // right after its payment; its fee was entered after that).
  const order = { opening: 0, charge: 1, payment: 1, returned: 1 };
  items.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || (a.entered ?? "").localeCompare(b.entered ?? ""));
  let balance = 0;
  const rows = items.map((r) => {
    balance += r.chargeCents - r.paymentCents;
    return { ...r, balanceCents: balance };
  });
  return { rows, balanceCents: balance };
}
