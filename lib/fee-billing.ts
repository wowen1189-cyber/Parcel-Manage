// Billing out management fees (Wesley Owen, Nov 2, 2026). Each month the management company bills every
// owner for that month's fees: the management fee on the gross income collected at each property (all of it:
// rent, fees, utility reimbursements, other income; not security deposits), plus leasing fees for leases that
// started and renewal fees for renewals applied. Pure math here; lib/fee-billing-data.ts reads the books.
//
// Approving a bill posts it on both sets of books at once:
//   owner:   Dr 5100 Management fees / 5110 Leasing and renewal fees   Cr 2050 Due to management company
//   manager: Dr 1150 Fees receivable from owners                       Cr 4100 / 4110 / 4120 fee income
// Paying it moves the cash on both:
//   owner:   Dr 2050   Cr 1000 operating cash
//   manager: Dr 1000   Cr 1150
// So the owner's statements and the management company's account always agree.

import { leasingFee, monthlyFee, renewalFee, type ManagementFee } from "./management-fees";

export type BookLine = { account: string; type: string; debit: number; credit: number; property_id: string | null };
export type BookEntry = { id: string; source: string; reversal_of: string | null; lines: BookLine[] };

// Entries that move money without being income: never counted as collected.
const NOT_INCOME = new Set(["opening", "opening_balance", "fee", "fee_payment", "distribution", "owner_money", "bill", "charge"]);
// Tenant payments (and deposits applied to what a tenant owed): everything they bring into operating cash counts.
const TENANT_MONEY = new Set(["payment", "deposit"]);

/** Gross income collected per property: tenant money into operating cash, plus other income received in cash, less returned payments. */
export function grossCollected(entries: BookEntry[], originalSource: Map<string, string> = new Map()): Map<string, number> {
  const out = new Map<string, number>();
  const add = (p: string | null, c: number) => p && c && out.set(p, (out.get(p) ?? 0) + c);
  for (const e of entries) {
    if (e.source === "reversal") {
      const orig = e.reversal_of ? originalSource.get(e.reversal_of) : undefined;
      if (orig && TENANT_MONEY.has(orig)) for (const l of e.lines) if (l.account === "1000") add(l.property_id, -l.credit);
      continue;
    }
    if (TENANT_MONEY.has(e.source)) {
      for (const l of e.lines) if (l.account === "1000") add(l.property_id, l.debit);
      continue;
    }
    if (NOT_INCOME.has(e.source)) continue;
    // Other cash receipts (a laundry deposit, a bank-feed item booked to income): the income credited.
    if (!e.lines.some((l) => l.account === "1000" && l.debit > 0)) continue;
    for (const l of e.lines) if (l.type === "income") add(l.property_id, l.credit - l.debit);
  }
  for (const [k, v] of out) if (v < 0) out.set(k, 0);
  return out;
}

export type FeeKind = "management" | "leasing" | "renewal";
export type FeeLine = { propertyId: string; property: string; kind: FeeKind; basisCents: number; detail: string; amountCents: number };
export const FEE_BILL_STATUS: Record<string, { label: string; tone: "neutral" | "warn" | "success" | "danger" | "info" }> = {
  draft: { label: "Draft", tone: "warn" },
  approved: { label: "Approved, unpaid", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  void: { label: "Void", tone: "neutral" },
};
export const FEE_KIND_LABEL: Record<FeeKind, string> = { management: "Management fee", leasing: "Leasing fee", renewal: "Renewal fee" };
/** Where each kind posts: the owner's expense, the management company's income. */
export const FEE_ACCOUNTS: Record<FeeKind, { expense: string; income: string }> = {
  management: { expense: "5100", income: "4100" },
  leasing: { expense: "5110", income: "4110" },
  renewal: { expense: "5110", income: "4120" },
};

export type FeeProperty = { id: string; name: string; fee: ManagementFee; grossCents: number; occupied: number; newLeaseRents: number[]; renewalRents: number[] };

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The month's fee lines for one owner's properties (zero lines left out). */
export function feeLines(properties: FeeProperty[]): FeeLine[] {
  const out: FeeLine[] = [];
  for (const p of properties) {
    const m = monthlyFee(p.fee, p.grossCents, p.occupied);
    if (m)
      out.push({
        propertyId: p.id,
        property: p.name,
        kind: "management",
        basisCents: p.grossCents,
        detail: p.fee.basis === "percent" ? `${p.fee.percent}% of ${usd(p.grossCents)} gross income collected` : p.fee.basis === "per_unit" ? `${usd(p.fee.flatCents)} × ${p.occupied} occupied units` : "Flat monthly fee",
        amountCents: m,
      });
    for (const rent of p.newLeaseRents) {
      const f = leasingFee(p.fee, rent);
      if (f) out.push({ propertyId: p.id, property: p.name, kind: "leasing", basisCents: rent, detail: `New lease at ${usd(rent)} a month`, amountCents: f });
    }
    for (const rent of p.renewalRents) {
      const f = renewalFee(p.fee, rent);
      if (f) out.push({ propertyId: p.id, property: p.name, kind: "renewal", basisCents: rent, detail: `Renewal at ${usd(rent)} a month`, amountCents: f });
    }
  }
  return out;
}

export const feeTotal = (lines: FeeLine[]) => lines.reduce((s, l) => s + l.amountCents, 0);

type Posting = { account: string; debit?: number; credit?: number; property_id?: string; memo?: string };

/** The two entries that post an approved bill: the owner's (expense, owed) and the management company's (receivable, income). */
export function approvalEntries(lines: FeeLine[]): { owner: Posting[]; manager: Posting[] } {
  const owner: Posting[] = [];
  const manager: Posting[] = [];
  for (const l of lines) {
    const memo = `${FEE_KIND_LABEL[l.kind]}: ${l.detail}`;
    owner.push({ account: FEE_ACCOUNTS[l.kind].expense, debit: l.amountCents, property_id: l.propertyId, memo }, { account: "2050", credit: l.amountCents, property_id: l.propertyId });
    manager.push({ account: "1150", debit: l.amountCents, memo: `${l.property}: ${memo}` }, { account: FEE_ACCOUNTS[l.kind].income, credit: l.amountCents, memo: l.property });
  }
  return { owner, manager };
}

/** The two entries that record the owner paying the bill. Per property on the owner's side, so each property's cash ties. */
export function paymentEntries(lines: FeeLine[]): { owner: Posting[]; manager: Posting[] } {
  const byProperty = new Map<string, number>();
  for (const l of lines) byProperty.set(l.propertyId, (byProperty.get(l.propertyId) ?? 0) + l.amountCents);
  const owner = [...byProperty].flatMap(([property_id, c]) => [
    { account: "2050", debit: c, property_id },
    { account: "1000", credit: c, property_id },
  ]);
  const total = feeTotal(lines);
  return { owner, manager: [{ account: "1000", debit: total }, { account: "1150", credit: total }] };
}

/** Months a fee bill can be made for: one that has ended. */
export function canBill(month: string, today: string): boolean {
  return month < today.slice(0, 7);
}
