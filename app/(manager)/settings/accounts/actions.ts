"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SECTIONS, TAX_LINES, TYPE_DIGIT, type AccountType } from "@/lib/accounts";
import { requireCompany } from "@/lib/session";

export type AccountState = { error?: string; message?: string; values?: Record<string, string>; saved?: number };

const EDIT_ROLES = ["admin", "accountant"];

/** Add an account, or rename / re-file / hide one. The number and type are fixed once an account exists. */
export async function saveAccount(prev: AccountState, form: FormData): Promise<AccountState> {
  const { supabase, company, membership } = await requireCompany();
  const values = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));
  if (!EDIT_ROLES.includes(membership.role)) return { error: "Only an admin or accountant can change the chart of accounts.", values };
  const p = z
    .object({
      id: z.union([z.literal(""), z.string().uuid()]).optional(),
      number: z.string().trim().optional(),
      type: z.enum(["asset", "liability", "equity", "income", "expense"]).optional(),
      name: z.string().trim().min(2, "Name the account.").max(80),
      section: z.string(),
      tax_line: z.string().optional(),
      active: z.string().optional(),
    })
    .safeParse(values);
  if (!p.success) return { error: p.error.issues[0].message, values };
  const d = p.data;
  const active = d.active === "on";

  if (d.id) {
    const { data: a } = await supabase.from("gl_account").select("id, number, type, system").eq("id", d.id).eq("company_id", company.id).maybeSingle();
    if (!a) return { error: "Account not found.", values };
    const type = a.type as AccountType;
    const problem = checkFiling(type, d.section, d.tax_line);
    if (problem) return { error: problem, values };
    if (!active && a.system) return { error: `${a.number} is used by Parcel Manage itself (rent, deposits, fees or owner money), so it can't be hidden.`, values };
    if (!active) {
      const { count } = await supabase.from("recurring_bill").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("expense_account", a.number).eq("active", true);
      if (count) return { error: `${count} recurring bill${count === 1 ? " uses" : "s use"} ${a.number}. Change or pause ${count === 1 ? "it" : "them"} first.`, values };
    }
    const { error } = await supabase.from("gl_account").update({ name: d.name, section: d.section, tax_line: d.tax_line || null, active }).eq("id", a.id).eq("company_id", company.id);
    if (error) return { error: error.message, values };
    revalidatePath("/settings/accounts");
    return { message: `Saved ${a.number} ${d.name}.`, saved: (prev.saved ?? 0) + 1 };
  }

  const number = d.number ?? "";
  const type = d.type;
  if (!type) return { error: "Choose the kind of account.", values };
  if (!/^\d{4}$/.test(number)) return { error: "Account numbers are 4 digits, like 5047.", values };
  if (number[0] !== TYPE_DIGIT[type]) return { error: `${typeWord(type)} accounts start with ${TYPE_DIGIT[type]} (${TYPE_DIGIT[type]}000–${TYPE_DIGIT[type]}999), so they sort with the rest.`, values };
  const problem = checkFiling(type, d.section, d.tax_line);
  if (problem) return { error: problem, values };
  const { error } = await supabase.from("gl_account").insert({ company_id: company.id, number, name: d.name, type, section: d.section, tax_line: d.tax_line || null, active: true });
  if (error) return { error: error.code === "23505" ? `${number} is already in your chart of accounts.` : error.message, values };
  revalidatePath("/settings/accounts");
  return { message: `Added ${number} ${d.name}.`, saved: (prev.saved ?? 0) + 1 };
}

function checkFiling(type: AccountType, section: string, taxLine: string | undefined): string | null {
  if (!SECTIONS[type].includes(section)) return "Choose a heading that fits this kind of account.";
  if (taxLine && !(type === "income" || type === "expense")) return "Only income and expense accounts go on Schedule E.";
  if (taxLine && !TAX_LINES.includes(taxLine)) return "Choose a Schedule E line from the list.";
  return null;
}

const typeWord = (t: AccountType) => ({ asset: "Asset", liability: "Liability", equity: "Equity", income: "Income", expense: "Expense" })[t];
