"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runRecurringBills } from "@/lib/bills";
import { todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export type RecurringState = { error?: string; message?: string };
const ROLES = ["admin", "accountant", "property_manager"];

export async function createRecurringBill(_: RecurringState, form: FormData): Promise<RecurringState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't set up recurring bills." };
  const p = z
    .object({
      vendor_id: z.string().uuid("Choose the vendor."),
      property_id: z.string().uuid("Choose the property."),
      amount: z.string().transform((v) => Math.round(Number(v.replace(/[$,\s]/g, "")) * 100)).refine((v) => v > 0, "Enter the amount."),
      expense_account: z.string().regex(/^\d{4}$/),
      memo: z.string().trim().min(2, "Describe it, like Monthly lawn care.").max(200),
      frequency: z.enum(["monthly", "quarterly", "yearly"]),
      next_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the first date."),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { amount, ...rest } = p.data;
  const { error } = await supabase.from("recurring_bill").insert({ company_id: company.id, ...rest, amount_cents: amount });
  if (error) return { error: error.message };
  revalidatePath("/recurring-bills");
  return { message: "Saved. A bill is created on each date and waits for approval." };
}

export async function toggleRecurringBill(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await supabase.from("recurring_bill").update({ active: form.get("active") === "1" }).eq("id", id.data).eq("company_id", company.id);
  revalidatePath("/recurring-bills");
}

export async function createDueNow(): Promise<RecurringState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't create bills." };
  const n = await runRecurringBills(supabase, company.id, todayIn(company.time_zone));
  revalidatePath("/recurring-bills");
  revalidatePath("/bills");
  return { message: n ? `Created ${n} bill${n === 1 ? "" : "s"} for approval.` : "Nothing is due." };
}
