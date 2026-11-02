"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayIn } from "@/lib/format";
import { runRecurringMaintenance } from "@/lib/recurring-maintenance";
import { requireCompany } from "@/lib/session";

export type RecurringState = { error?: string; message?: string; values?: Record<string, string> };
const ROLES = ["admin", "property_manager", "maintenance"];

export async function createSchedule(_: RecurringState, form: FormData): Promise<RecurringState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't set up recurring maintenance." };
  const values = Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const p = z
    .object({
      property_id: z.string().uuid("Choose the property."),
      unit_id: z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null),
      title: z.string().trim().min(2, "Say what's done, like Replace AC filter.").max(200),
      details: z.string().trim().max(2000).transform((v) => v || null),
      vendor_id: z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null),
      frequency: z.enum(["monthly", "quarterly", "twice_yearly", "yearly"]),
      next_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the first date."),
    })
    .safeParse(values);
  if (!p.success) return { error: p.error.issues[0].message, values };
  const { data: prop } = await supabase.from("property").select("id").eq("id", p.data.property_id).eq("company_id", company.id).maybeSingle();
  if (!prop) return { error: "Choose the property.", values };
  if (p.data.unit_id) {
    const { data: unit } = await supabase.from("unit").select("id").eq("id", p.data.unit_id).eq("property_id", prop.id).maybeSingle();
    if (!unit) return { error: "That unit isn't in this property.", values };
  }
  const { error } = await supabase.from("recurring_work_order").insert({ company_id: company.id, ...p.data });
  if (error) return { error: error.message, values };
  revalidatePath("/maintenance/recurring");
  return { message: "Saved. A work order is created on each date for you to assign." };
}

export async function toggleSchedule(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await supabase.from("recurring_work_order").update({ active: form.get("active") === "1" }).eq("id", id.data).eq("company_id", company.id);
  revalidatePath("/maintenance/recurring");
}

export async function deleteSchedule(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await supabase.from("recurring_work_order").delete().eq("id", id.data).eq("company_id", company.id);
  revalidatePath("/maintenance/recurring");
}

export async function createDueNow(): Promise<RecurringState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't create work orders." };
  const n = await runRecurringMaintenance(supabase, company.id, todayIn(company.time_zone));
  revalidatePath("/maintenance/recurring");
  revalidatePath("/maintenance");
  return { message: n ? `Created ${n} work order${n === 1 ? "" : "s"}.` : "Nothing is due." };
}
