// The itemized owner statement (Wesley Owen, Nov 2, 2026): every income and expense line for the month, by
// property, and how the cash moved from beginning to ending, so the partners can see each expense and how it
// ties to what was sent to them. Pure logic here; lib/owner-close.ts reads the books.

export type DetailLine = {
  entryId: string;
  date: string;
  source: string;
  account: string;
  accountName: string;
  type: string; // gl_account.type: asset, liability, equity, income, expense
  debit: number;
  credit: number;
  propertyId: string | null;
  unit: string | null;
  memo: string; // the line's memo, else the entry's
  payee?: string | null; // vendor on a bill
};

export type DetailItem = { date: string; account: string; description: string; unit: string | null; amountCents: number };
export type DetailGroup = { propertyId: string | null; name: string; income: DetailItem[]; expenses: DetailItem[]; incomeCents: number; expensesCents: number; netCents: number };

export const CASH_KINDS = {
  collected: "Collected from tenants and other income",
  bills: "Bills and expenses paid",
  fees: "Management, leasing and renewal fees paid",
  distributions: "Owner distributions and draws",
  contributions: "Owner contributions",
  other: "Other (transfers, loans, adjustments)",
} as const;
export type CashKind = keyof typeof CASH_KINDS;
export type CashRow = { kind: CashKind; label: string; inCents: number; outCents: number };

export type StatementDetail = {
  groups: DetailGroup[];
  cash: { beginningCents: number; rows: CashRow[]; inCents: number; outCents: number; endingCents: number; tiesToBooks: boolean };
};

const byDate = (a: DetailItem, b: DetailItem) => a.date.localeCompare(b.date) || a.account.localeCompare(b.account);

/**
 * Income and expense lines grouped by property (lines not tied to a property go last, under the owner).
 * Fees the month's bill hasn't posted yet are added as expenses, so the totals match the statement's.
 */
export function itemize(lines: DetailLine[], properties: { id: string; name: string }[], unpostedFees: { propertyId: string; label: string; amountCents: number }[] = [], periodEnd = ""): DetailGroup[] {
  const groups = new Map<string | null, DetailGroup>();
  const group = (id: string | null) => {
    let g = groups.get(id);
    if (!g) {
      g = { propertyId: id, name: properties.find((p) => p.id === id)?.name ?? "Not tied to a property", income: [], expenses: [], incomeCents: 0, expensesCents: 0, netCents: 0 };
      groups.set(id, g);
    }
    return g;
  };
  for (const p of properties) group(p.id);
  for (const l of lines) {
    if (l.type !== "income" && l.type !== "expense") continue;
    const amount = l.type === "income" ? l.credit - l.debit : l.debit - l.credit;
    if (!amount) continue;
    const item: DetailItem = { date: l.date, account: `${l.account} ${l.accountName}`, description: [l.payee, l.memo].filter(Boolean).join(": ") || l.accountName, unit: l.unit, amountCents: amount };
    (l.type === "income" ? group(l.propertyId).income : group(l.propertyId).expenses).push(item);
  }
  for (const f of unpostedFees) group(f.propertyId).expenses.push({ date: periodEnd, account: "Fees", description: `${f.label} (on this month's fee bill)`, unit: null, amountCents: f.amountCents });
  const out = [...groups.values()].map((g) => {
    g.income.sort(byDate);
    g.expenses.sort(byDate);
    g.incomeCents = g.income.reduce((s, i) => s + i.amountCents, 0);
    g.expensesCents = g.expenses.reduce((s, i) => s + i.amountCents, 0);
    g.netCents = g.incomeCents - g.expensesCents;
    return g;
  });
  // Properties in their order, then lines with no property; skip an empty "no property" group.
  return out.filter((g) => g.propertyId !== null || g.income.length || g.expenses.length).sort((a, b) => Number(a.propertyId === null) - Number(b.propertyId === null));
}

/** What a cash movement was, from the other side of its entry. */
export function cashKind(entryLines: DetailLine[], source: string): CashKind {
  const other = entryLines.filter((l) => l.account !== "1000");
  const has = (pred: (l: DetailLine) => boolean) => other.some(pred);
  if (source === "distribution" || has((l) => l.account === "3100")) return "distributions";
  if (has((l) => l.account === "3000")) return "contributions";
  if (source === "fee_payment" || has((l) => l.account === "2050")) return "fees";
  if (has((l) => l.type === "income" || l.account === "1100")) return "collected";
  if (source === "bill" || has((l) => l.type === "expense" || l.account === "2000")) return "bills";
  return "other";
}

/**
 * Beginning cash, money in and out of the operating account (1000) by kind, and ending cash. `endingCents` is
 * the books' real ending balance; tiesToBooks says beginning + in - out lands on it.
 */
export function cashFlow(lines: DetailLine[], beginningCents: number, endingCents: number): StatementDetail["cash"] {
  const entries = new Map<string, DetailLine[]>();
  for (const l of lines) entries.set(l.entryId, [...(entries.get(l.entryId) ?? []), l]);
  const rows = new Map<CashKind, CashRow>();
  for (const ls of entries.values()) {
    const cash = ls.filter((l) => l.account === "1000").reduce((s, l) => s + l.debit - l.credit, 0);
    if (!cash) continue;
    const kind = cashKind(ls, ls[0].source);
    const r = rows.get(kind) ?? { kind, label: CASH_KINDS[kind], inCents: 0, outCents: 0 };
    if (cash > 0) r.inCents += cash;
    else r.outCents -= cash;
    rows.set(kind, r);
  }
  const ordered = (Object.keys(CASH_KINDS) as CashKind[]).map((k) => rows.get(k)).filter((r): r is CashRow => Boolean(r));
  const inCents = ordered.reduce((s, r) => s + r.inCents, 0);
  const outCents = ordered.reduce((s, r) => s + r.outCents, 0);
  return { beginningCents, rows: ordered, inCents, outCents, endingCents, tiesToBooks: beginningCents + inCents - outCents === endingCents };
}

/** The same detail as plain lines, for the PDF and e-mail. */
export function detailRows(detail: StatementDetail, fmt: (cents: number) => string): string[] {
  const c = detail.cash;
  return [
    "WHERE THE CASH WENT",
    `Beginning cash: ${fmt(c.beginningCents)}`,
    ...c.rows.map((r) => `${r.label}: ${r.inCents ? `in ${fmt(r.inCents)}` : ""}${r.inCents && r.outCents ? ", " : ""}${r.outCents ? `out ${fmt(r.outCents)}` : ""}`),
    `Ending cash: ${fmt(c.endingCents)}`,
    ...detail.groups.flatMap((g) => [
      `${g.name.toUpperCase()}: income ${fmt(g.incomeCents)}, expenses ${fmt(g.expensesCents)}, net ${fmt(g.netCents)}`,
      ...g.income.map((i) => `  Income ${i.date}: ${i.description}${i.unit ? ` (${i.unit})` : ""} ${fmt(i.amountCents)}`),
      ...g.expenses.map((i) => `  Expense ${i.date}: ${i.description}${i.unit ? ` (${i.unit})` : ""} ${fmt(i.amountCents)}`),
    ]),
  ];
}
