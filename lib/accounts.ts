import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// The company's chart of accounts (migration 0062). Each company starts with the standard list and can add,
// rename and hide accounts in Settings › Accounts. Dropdowns read it from here instead of a fixed list.

type Db = SupabaseClient<Database>;
export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountOption = { number: string; name: string; section: string };
export type Account = AccountOption & { id: string; type: AccountType; tax_line: string | null; system: boolean; active: boolean; is_trust: boolean };

export const TYPE_LABEL: Record<AccountType, string> = { asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: "Expenses" };

/** Headings each type of account can sit under, in the order they're listed. */
export const SECTIONS: Record<AccountType, string[]> = {
  asset: ["Cash", "Receivables and other assets", "Capital improvements"],
  liability: ["Liabilities"],
  equity: ["Equity"],
  income: ["Rental income", "Other tenant income", "Other income", "Management company income"],
  expense: ["Repairs and maintenance", "Management and leasing", "Administrative and professional", "Utilities", "Insurance and taxes", "Financing", "Depreciation", "Payroll", "Other expenses"],
};

/** IRS Schedule E (Form 1040) lines an income or expense account can be reported on. */
export const TAX_LINES = [
  "Line 3 Rents received",
  "Line 5 Advertising",
  "Line 6 Auto and travel",
  "Line 7 Cleaning and maintenance",
  "Line 8 Commissions",
  "Line 9 Insurance",
  "Line 10 Legal and other professional fees",
  "Line 11 Management fees",
  "Line 12 Mortgage interest paid to banks",
  "Line 13 Other interest",
  "Line 14 Repairs",
  "Line 15 Supplies",
  "Line 16 Taxes",
  "Line 17 Utilities",
  "Line 18 Depreciation",
  "Line 19 Other",
];

const ORDER: AccountType[] = ["asset", "liability", "equity", "income", "expense"];
const sectionRank = (a: Pick<Account, "type" | "section">) => ORDER.indexOf(a.type) * 100 + Math.max(0, SECTIONS[a.type].indexOf(a.section));

/** Sorted by type, then heading, then number. */
export function sortAccounts<T extends Pick<Account, "type" | "section" | "number">>(list: T[]): T[] {
  return [...list].sort((a, b) => sectionRank(a) - sectionRank(b) || a.number.localeCompare(b.number));
}

/** What a bill can be charged to: any expense, or a capital improvement (it goes on the balance sheet). */
export function billable(a: Pick<Account, "type" | "section">): boolean {
  return a.type === "expense" || (a.type === "asset" && a.section === "Capital improvements");
}

export function validAccountNumber(n: string): boolean {
  return /^\d{4}$/.test(n);
}

/** The expected first digit for each type, so new accounts land in the right range. */
export const TYPE_DIGIT: Record<AccountType, string> = { asset: "1", liability: "2", equity: "3", income: "4", expense: "5" };

export async function loadAccounts(db: Db, companyId: string): Promise<Account[]> {
  const read = () => db.from("gl_account").select("id, number, name, type, section, tax_line, system, active, is_trust").eq("company_id", companyId);
  let { data } = await read();
  if (!data?.length) {
    await db.rpc("ensure_chart_of_accounts", { p_company: companyId });
    ({ data } = await read());
  }
  return sortAccounts((data ?? []).map((a) => ({ ...a, type: a.type as AccountType, section: a.section ?? SECTIONS[a.type as AccountType][0] })));
}

/** Active accounts a bill (or an owner's out-of-pocket expense) can be charged to, for dropdowns. */
export async function billAccounts(db: Db, companyId: string, keep?: string | null): Promise<AccountOption[]> {
  const list = (await loadAccounts(db, companyId)).filter((a) => billable(a) && (a.active || a.number === keep));
  // Expenses first: most bills are expenses; capital improvements come last.
  return [...list.filter((a) => a.type === "expense"), ...list.filter((a) => a.type !== "expense")].map(({ number, name, section }) => ({ number, name, section }));
}

/** Why a bill can't be charged to this account, or null if it can. */
export async function billAccountProblem(db: Db, companyId: string, number: string | undefined): Promise<string | null> {
  if (!number) return "Choose the expense account.";
  const { data: a } = await db.from("gl_account").select("type, section, active").eq("company_id", companyId).eq("number", number).maybeSingle();
  if (!a) return `Account ${number} isn't in your chart of accounts.`;
  if (!a.active) return `Account ${number} is hidden. Choose another, or show it again in Settings › Accounts.`;
  if (!billable({ type: a.type as AccountType, section: a.section ?? "" })) return `Account ${number} isn't an expense or capital improvement account.`;
  return null;
}
