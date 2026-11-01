// Bank statements and matching. Reads the CSV most banks export (date, description, and either one signed
// amount or separate debit/credit columns) and matches each transaction to a journal line on that cash
// account: same amount, within 5 days, closest date first.

import { parseCsv } from "@/lib/import/appfolio";

export type BankRow = { posted_on: string; description: string; amount_cents: number };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function toIsoDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

function toCents(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  const n = Number(s.replace(/[()$,\s-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) * (negative ? -1 : 1);
}

export function parseBankCsv(text: string): { rows: BankRow[]; error?: string } {
  const all = parseCsv(text).filter((r) => r.some((c) => c.trim()));
  const headerIndex = all.findIndex((r) => r.some((c) => /date/i.test(c)) && r.some((c) => /amount|debit|credit|withdrawal|deposit/i.test(c)));
  if (headerIndex < 0) return { rows: [], error: "Couldn't find the date and amount columns. Export the statement as CSV with headers." };
  const head = all[headerIndex].map(norm);
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const date = col("postingdate", "posteddate", "transactiondate", "date");
  const desc = col("description", "memo", "payee", "details", "name");
  const amount = head.findIndex((h) => h === "amount" || h === "transactionamount");
  const debit = col("debit", "withdrawal");
  const credit = col("credit", "deposit");
  const rows: BankRow[] = [];
  for (const r of all.slice(headerIndex + 1)) {
    const posted = toIsoDate(r[date] ?? "");
    if (!posted) continue;
    let cents: number | null = null;
    if (amount >= 0) cents = toCents(r[amount] ?? "");
    else {
      const d = toCents(r[debit] ?? "");
      const c = toCents(r[credit] ?? "");
      cents = (c ? Math.abs(c) : 0) - (d ? Math.abs(d) : 0);
    }
    if (!cents) continue;
    rows.push({ posted_on: posted, description: (r[desc] ?? "").trim().slice(0, 300) || "(no description)", amount_cents: cents });
  }
  return rows.length ? { rows } : { rows, error: "No transactions found in that file." };
}

export const fingerprint = (r: BankRow) => `${r.posted_on}|${r.amount_cents}|${r.description.toLowerCase().replace(/\s+/g, " ").slice(0, 80)}`;

export type BookLine = { id: string; entry_date: string; memo: string; amount_cents: number };

const days = (a: string, b: string) => Math.abs(new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / 86_400_000;

/** Best book line for a bank transaction: same amount, within 5 days, not already used. */
export function suggestMatch(tx: BankRow, lines: BookLine[], used: Set<string>): BookLine | null {
  return (
    lines
      .filter((l) => !used.has(l.id) && l.amount_cents === tx.amount_cents && days(l.entry_date, tx.posted_on) <= 5)
      .sort((a, b) => days(a.entry_date, tx.posted_on) - days(b.entry_date, tx.posted_on))[0] ?? null
  );
}
