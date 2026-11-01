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
