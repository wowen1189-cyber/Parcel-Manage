"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fingerprint, parseBankCsv } from "@/lib/bank";
import { autoMatch, bookLines } from "@/lib/bank-books";
import { requireCompany } from "@/lib/session";

export type BankState = { error?: string; message?: string };
const ROLES = ["admin", "accountant"];
const NOT_ALLOWED = "Only an admin or accountant can work with bank accounts.";

export async function createBankAccount(_: BankState, form: FormData): Promise<BankState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const p = z
    .object({ entity_id: z.string().uuid("Choose the owner."), name: z.string().trim().min(2, "Name the account.").max(80), institution: z.string().trim().max(80).optional(), last4: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits."), gl_number: z.enum(["1000", "1010"]) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await supabase.from("bank_account").insert({ company_id: company.id, ...p.data, institution: p.data.institution || null });
  if (error) return { error: error.code === "23505" ? "That account is already set up." : error.message };
  revalidatePath("/bank-accounts");
  return { message: "Added." };
}

/** Import a statement CSV; duplicates (same date, amount and description) are skipped. Then auto-match. */
export async function importStatement(_: BankState, form: FormData): Promise<BankState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("bank_account_id"));
  const file = form.get("file");
  if (!id.success || !(file instanceof File) || !file.size) return { error: "Choose the statement CSV." };
  if (file.size > 900_000) return { error: "That file is too big. Export one month at a time." };
  const parsed = parseBankCsv(await file.text());
  if (parsed.error) return { error: parsed.error };
  const rows = parsed.rows.map((r) => ({ company_id: company.id, bank_account_id: id.data, ...r, fingerprint: fingerprint(r) }));
  const { data, error } = await supabase.from("bank_transaction").upsert(rows, { onConflict: "bank_account_id,fingerprint", ignoreDuplicates: true }).select("id");
  if (error) return { error: error.message };
  const matched = await autoMatch(supabase, company.id, id.data);
  revalidatePath(`/bank-accounts/${id.data}`);
  return { message: `Imported ${data?.length ?? 0} new transactions (${parsed.rows.length - (data?.length ?? 0)} already here). Matched ${matched} automatically.` };
}


export async function setTransaction(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const p = z.object({ id: z.string().uuid(), action: z.enum(["match", "ignore", "unmatch"]), line_id: z.string().optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { data: tx } = await supabase.from("bank_transaction").select("id, bank_account_id").eq("id", p.data.id).eq("company_id", company.id).single();
  if (!tx) return;
  const update =
    p.data.action === "match" && z.string().uuid().safeParse(p.data.line_id).success
      ? { journal_line_id: p.data.line_id!, status: "matched" }
      : p.data.action === "ignore"
        ? { journal_line_id: null, status: "ignored" }
        : { journal_line_id: null, status: "unmatched" };
  await supabase.from("bank_transaction").update(update).eq("id", tx.id);
  revalidatePath(`/bank-accounts/${tx.bank_account_id}`);
}

/**
 * Reconcile to a statement: the checked book lines (matched ones are pre-checked) plus everything cleared
 * before must equal the statement's ending balance exactly.
 */
export async function reconcile(_: BankState, form: FormData): Promise<BankState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const p = z
    .object({ bank_account_id: z.string().uuid(), statement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the statement date."), statement_balance: z.string().transform((v) => Math.round(Number(v.replace(/[$,\s]/g, "")) * 100)) })
    .safeParse(Object.fromEntries(form));
  if (!p.success || Number.isNaN(p.data.statement_balance)) return { error: "Enter the statement date and ending balance." };
  const { data: account } = await supabase.from("bank_account").select("entity_id, gl_number").eq("id", p.data.bank_account_id).eq("company_id", company.id).single();
  if (!account) return { error: "Account not found." };
  const lines = await bookLines(supabase, company.id, account, p.data.statement_date);
  const checked = new Set(form.getAll("line").map(String));
  const clearing = lines.filter((l) => !l.cleared && checked.has(l.id));
  const cleared = lines.filter((l) => l.cleared).reduce((s, l) => s + l.amount_cents, 0) + clearing.reduce((s, l) => s + l.amount_cents, 0);
  const diff = p.data.statement_balance - cleared;
  if (diff !== 0) return { error: `Off by $${(diff / 100).toFixed(2)}. Cleared items total $${(cleared / 100).toFixed(2)}; the statement says $${(p.data.statement_balance / 100).toFixed(2)}. Check items, or post a journal entry for bank fees or interest.` };
  const { data: rec, error } = await supabase.from("reconciliation").insert({ company_id: company.id, bank_account_id: p.data.bank_account_id, statement_date: p.data.statement_date, statement_balance_cents: p.data.statement_balance, cleared_balance_cents: cleared, completed_by: user.id }).select("id").single();
  if (error) return { error: error.code === "23505" ? "That statement date is already reconciled." : error.message };
  if (clearing.length) await supabase.from("bank_cleared_line").insert(clearing.map((l) => ({ journal_line_id: l.id, company_id: company.id, reconciliation_id: rec.id })));
  revalidatePath(`/bank-accounts/${p.data.bank_account_id}`);
  return { message: `Reconciled to $0.00 difference as of ${p.data.statement_date}.` };
}
