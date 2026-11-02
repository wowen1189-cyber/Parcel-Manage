// Report math kept pure so it can be tested.

export type Aging = { current: number; d30: number; d60: number; d90: number; total: number };

/**
 * Aged receivables as of a date: payments and credits pay off the oldest charges first, and whatever is left
 * is bucketed by days past due (0–30, 31–60, 61–90, over 90).
 */
export function aging(charges: { amount_cents: number; due_date: string }[], paidCents: number, asOf: string): Aging {
  const out: Aging = { current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
  let credit = paidCents;
  for (const c of [...charges].filter((c) => c.due_date <= asOf).sort((a, b) => a.due_date.localeCompare(b.due_date))) {
    const open = Math.max(0, c.amount_cents - credit);
    credit = Math.max(0, credit - c.amount_cents);
    if (!open) continue;
    const days = Math.round((Date.parse(`${asOf}T12:00:00Z`) - Date.parse(`${c.due_date}T12:00:00Z`)) / 86_400_000);
    if (days <= 30) out.current += open;
    else if (days <= 60) out.d30 += open;
    else if (days <= 90) out.d60 += open;
    else out.d90 += open;
    out.total += open;
  }
  return out;
}

/** Occupancy as a share of units, 0–1. */
export const occupancy = (occupied: number, total: number) => (total ? occupied / total : 0);

export type Column = { key: string; label: string; kind?: "text" | "money" | "date" | "number" | "percent" };

/** CSV with a header row; money as dollars, so spreadsheets read it as numbers. */
export function toCsv(columns: Column[], rows: Record<string, unknown>[]): string {
  const cell = (v: unknown, kind?: Column["kind"]) => {
    if (v === null || v === undefined) return "";
    const s = kind === "money" ? (Number(v) / 100).toFixed(2) : kind === "percent" ? (Number(v) * 100).toFixed(1) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(r[c.key], c.kind)).join(","))].join("\n");
}

export type CashLine = { account: string; cash: boolean; debit: number; credit: number };
export type CashFlowRow = { account: string; cashIn: number; cashOut: number; net: number };

/**
 * Direct-method cash flow: for each journal entry that moves cash, the cash goes to (or comes from) the
 * entry's other accounts. An entry with one other account is straightforward; with several, the cash is
 * split by each account's share of the non-cash side. Cash-to-cash moves (operating to trust) net to zero.
 */
export function cashFlow(entries: CashLine[][]): CashFlowRow[] {
  const by = new Map<string, CashFlowRow>();
  for (const lines of entries) {
    const cashNet = lines.filter((l) => l.cash).reduce((s, l) => s + l.debit - l.credit, 0);
    const others = lines.filter((l) => !l.cash);
    if (!cashNet || !others.length) continue;
    // Each other account's effect, signed like the cash (credits to income are cash in).
    const effects = others.map((l) => ({ account: l.account, amount: l.credit - l.debit }));
    const total = effects.reduce((s, e) => s + e.amount, 0);
    let left = cashNet;
    effects.forEach((e, i) => {
      const share = i === effects.length - 1 ? left : total ? Math.round((cashNet * e.amount) / total) : 0;
      left -= share;
      if (!share) return;
      const row = by.get(e.account) ?? { account: e.account, cashIn: 0, cashOut: 0, net: 0 };
      if (share > 0) row.cashIn += share;
      else row.cashOut += -share;
      row.net += share;
      by.set(e.account, row);
    });
  }
  return [...by.values()].sort((a, b) => b.cashIn - a.cashIn || a.cashOut - b.cashOut);
}
