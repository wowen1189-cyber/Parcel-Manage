// Owner statements: the monthly close for one owner (LLC). Pure math here; lib/owner-close.ts reads the books.
//
// Fees come from the month's fee bill (lib/fee-billing.ts): the management fee on gross income collected,
// leasing fees for new leases and renewal fees for renewals. What's distributable is operating cash after fees, less unpaid approved
// bills and the owner's cash reserve, never below zero (docs/02: distributions after expenses, debt service
// and reserve). It's split by ownership percent when the owner's properties have partners.

export type StatementProperty = {
  id: string;
  name: string;
  collectedCents: number;
  occupied: number;
  feeTerms: string;
  managementFeeCents: number;
  leasingFeeCents: number;
  newLeases: number;
};

export type StatementTotals = {
  beginningCashCents: number;
  incomeCents: number;
  expensesCents: number;
  feesCents: number;
  endingCashCents: number;
  payablesCents: number;
  reserveCents: number;
  distributableCents: number;
  depositsHeldCents: number;
  // Own-books owners: money the owner took out (owner draws) and put in this month. Older statements lack them.
  drawsCents?: number;
  contributionsCents?: number;
};

export function distributable(endingCashCents: number, payablesCents: number, reserveCents: number): number {
  return Math.max(0, endingCashCents - payablesCents - reserveCents);
}

export type Payee = { contactId: string | null; name: string; pct: number };

/** Split by percent, in cents; any rounding cent goes to the largest share so the total is exact. */
export function splitByOwnership(amountCents: number, payees: Payee[]): (Payee & { amountCents: number })[] {
  if (!payees.length) return [];
  const total = payees.reduce((s, p) => s + p.pct, 0) || 100;
  const rows = payees.map((p) => ({ ...p, amountCents: Math.floor((amountCents * p.pct) / total) }));
  const left = amountCents - rows.reduce((s, r) => s + r.amountCents, 0);
  if (left) rows.reduce((a, b) => (b.pct > a.pct ? b : a)).amountCents += left;
  return rows;
}

/**
 * Who gets paid: the partners on the owner's properties when every property has the same partners
 * (e.g. a co-owned building held by one LLC), otherwise the owner itself.
 */
export function payeesFor(ownerName: string, properties: { partners: { contactId: string; name: string; pct: number }[] }[]): Payee[] {
  const sets = properties.map((p) =>
    p.partners
      .map((x) => `${x.contactId}:${x.pct}`)
      .sort()
      .join("|"),
  );
  const first = properties[0]?.partners ?? [];
  if (first.length && sets.every((s) => s === sets[0])) return first.map((x) => ({ contactId: x.contactId, name: x.name, pct: x.pct }));
  return [{ contactId: null, name: ownerName, pct: 100 }];
}

export const monthStart = (month: string) => `${month}-01`;
export function monthEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}
export function previousMonth(today: string) {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}
