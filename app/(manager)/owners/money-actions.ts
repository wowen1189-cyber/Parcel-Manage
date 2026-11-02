"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { money } from "@/lib/format";
import { OWNER_MONEY_LABEL, ownerMoneyLines, type OwnerMoneyKind } from "@/lib/owner-money";
import { requireCompany } from "@/lib/session";

// How an owner's money works (managed vs own books), and the owner-to-LLC money entries (lib/owner-money.ts).

export type MoneyState = { error?: string; message?: string };

const cents = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  if (!s) return 0;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : NaN;
};

export async function saveBooksMode(_: MoneyState, form: FormData): Promise<MoneyState> {
  const { supabase, company, membership } = await requireCompany();
  if (!["admin", "accountant"].includes(membership.role)) return { error: "Only an admin or accountant can change this." };
  const p = z.object({ entity_id: z.string().uuid(), books_mode: z.enum(["managed", "own_books"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Choose how this owner's money works." };
  const { error } = await supabase.from("entity").update({ books_mode: p.data.books_mode }).eq("id", p.data.entity_id).eq("company_id", company.id).eq("is_manager", false);
  if (error) return { error: error.message };
  revalidatePath(`/owners/${p.data.entity_id}`);
  revalidatePath("/owners");
  return { message: "Saved." };
}

/** Post one owner draw, contribution, outside-paid expense or loan payment. A person enters it, so it posts. */
export async function recordOwnerMoney(_: MoneyState, form: FormData): Promise<MoneyState> {
  const { supabase, company, membership } = await requireCompany();
  if (!["admin", "accountant"].includes(membership.role)) return { error: "Only an admin or accountant can record owner money." };
  const p = z
    .object({
      entity_id: z.string().uuid(),
      kind: z.enum(["draw", "contribution", "paid_personally", "loan_payment"]),
      entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date."),
      property_id: z.string().optional(),
      expense_account: z.string().optional(),
      memo: z.string().trim().max(200).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const amount = cents(form.get("amount"));
  const interest = cents(form.get("interest"));
  const principal = cents(form.get("principal"));
  if ([amount, interest, principal].some(Number.isNaN)) return { error: "Enter amounts as dollars, like 1500 or 99.50." };
  const { data: owner } = await supabase.from("entity").select("id, name, property(id)").eq("id", p.data.entity_id).eq("company_id", company.id).maybeSingle();
  if (!owner) return { error: "Owner not found." };
  const propertyId = p.data.property_id && owner.property.some((x) => x.id === p.data.property_id) ? p.data.property_id : null;
  const kind = p.data.kind as OwnerMoneyKind;
  const r = ownerMoneyLines({ kind, amountCents: amount, interestCents: interest, principalCents: principal, expenseAccount: p.data.expense_account, propertyId });
  if (!r.lines) return { error: r.error };
  const total = kind === "loan_payment" ? interest + principal : amount;
  const { error } = await supabase.rpc("post_journal_entry", {
    p_company: company.id,
    p_entity: owner.id,
    p_date: p.data.entry_date,
    p_memo: p.data.memo || OWNER_MONEY_LABEL[kind].replace(/ \(.*\)$/, ""),
    p_source: "owner_money",
    p_lines: r.lines,
  });
  if (error) return { error: error.message };
  revalidatePath(`/owners/${owner.id}`);
  revalidatePath("/accounting");
  return { message: `Posted: ${OWNER_MONEY_LABEL[kind].replace(/ \(.*\)$/, "").toLowerCase()}, ${money(total)}.` };
}
