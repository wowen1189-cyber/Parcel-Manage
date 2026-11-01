"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkEntry, type EntryLineInput } from "@/lib/books";
import { todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export type EntryState = { error?: string; values?: Record<string, string> };
const BOOK_ROLES = ["admin", "accountant"];

const amount = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  if (!s) return 0;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : NaN;
};

/** A manual journal entry. It posts only when balanced (the database checks again). */
export async function createJournalEntry(_: EntryState, form: FormData): Promise<EntryState> {
  const { supabase, company, membership } = await requireCompany();
  const values = Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  if (!BOOK_ROLES.includes(membership.role)) return { error: "Only an admin or accountant can post journal entries.", values };
  const head = z
    .object({ entity_id: z.string().uuid("Choose the owner."), entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date."), memo: z.string().trim().min(3, "Describe the entry.").max(300) })
    .safeParse(values);
  if (!head.success) return { error: head.error.issues[0].message, values };
  const lines: EntryLineInput[] = [];
  for (let i = 0; i < 12; i++) {
    const account = String(form.get(`account_${i}`) ?? "");
    const debit = amount(form.get(`debit_${i}`));
    const credit = amount(form.get(`credit_${i}`));
    if (Number.isNaN(debit) || Number.isNaN(credit)) return { error: `Line ${i + 1}: enter amounts like 125 or 125.00.`, values };
    if (!account && !debit && !credit) continue;
    lines.push({ account, debit, credit, property_id: String(form.get(`property_${i}`) ?? "") || null, memo: String(form.get(`line_memo_${i}`) ?? "") || null });
  }
  const problem = checkEntry(lines);
  if (problem) return { error: problem, values };
  const { data, error } = await supabase.rpc("post_journal_entry", {
    p_company: company.id,
    p_entity: head.data.entity_id,
    p_date: head.data.entry_date,
    p_memo: head.data.memo,
    p_source: "manual",
    p_lines: lines.filter((l) => l.debit || l.credit).map((l) => ({ account_id: l.account, debit: l.debit, credit: l.credit, property_id: l.property_id ?? "", memo: l.memo })),
  });
  if (error) return { error: error.message, values };
  revalidatePath("/journal-entries");
  revalidatePath("/accounting");
  redirect(`/journal-entries/${data}?posted=1`);
}

export async function reverseJournalEntry(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!BOOK_ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const memo = String(form.get("memo") ?? "").trim() || "Reversal";
  const { data, error } = await supabase.rpc("reverse_journal_entry", { p_entry: id.data, p_date: todayIn(company.time_zone), p_memo: memo });
  if (error) redirect(`/journal-entries/${id.data}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/journal-entries");
  revalidatePath("/accounting");
  redirect(`/journal-entries/${data}?posted=1`);
}
