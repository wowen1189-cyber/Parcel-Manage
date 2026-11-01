// Reading an owner's books: account balances shown the way accountants read them (assets and expenses
// as debit balances, liabilities, equity and income as credit balances), and simple statements.

export type AccountBalance = { account_id: string; number: string; name: string; type: string; is_trust: boolean; debit_cents: number; credit_cents: number };

export const ACCOUNT_TYPE_LABEL: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: "Expenses" };
export const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;

/** Balance in the account's normal direction. */
export function normalBalance(a: { type: string; debit_cents: number; credit_cents: number }): number {
  const net = Number(a.debit_cents) - Number(a.credit_cents);
  return a.type === "asset" || a.type === "expense" ? net : -net;
}

/** Debits and credits must match across all accounts. */
export function trialBalanceTotals(rows: AccountBalance[]) {
  const debit = rows.reduce((s, r) => s + Number(r.debit_cents), 0);
  const credit = rows.reduce((s, r) => s + Number(r.credit_cents), 0);
  return { debit, credit, balanced: debit === credit };
}

/** Net income for a period: income less expenses. */
export function netIncome(rows: AccountBalance[]): number {
  return rows.filter((r) => r.type === "income").reduce((s, r) => s + normalBalance(r), 0) - rows.filter((r) => r.type === "expense").reduce((s, r) => s + normalBalance(r), 0);
}

export type EntryLineInput = { account: string; debit: number; credit: number; property_id?: string | null; memo?: string | null };

/** A manual entry can post only when every line is one-sided and debits equal credits. */
export function checkEntry(lines: EntryLineInput[]): string | null {
  const used = lines.filter((l) => l.debit || l.credit);
  if (used.length < 2) return "An entry needs at least two lines.";
  if (used.some((l) => !l.account)) return "Choose an account on every line.";
  if (used.some((l) => l.debit && l.credit)) return "Each line is either a debit or a credit, not both.";
  if (used.some((l) => l.debit < 0 || l.credit < 0)) return "Amounts can't be negative.";
  const d = used.reduce((s, l) => s + l.debit, 0);
  const c = used.reduce((s, l) => s + l.credit, 0);
  if (d !== c) return `Debits ($${(d / 100).toFixed(2)}) and credits ($${(c / 100).toFixed(2)}) must match to post.`;
  return null;
}
