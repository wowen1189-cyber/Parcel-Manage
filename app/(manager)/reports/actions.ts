"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FREQUENCIES } from "@/lib/report-schedule";
import { reportById } from "@/lib/reports";
import { requireCompany } from "@/lib/session";

export type ScheduleState = { error?: string; message?: string };
const ROLES = ["admin", "accountant", "property_manager"];

export async function scheduleReport(_: ScheduleState, form: FormData): Promise<ScheduleState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't schedule reports." };
  const p = z
    .object({ report_key: z.string(), frequency: z.enum(Object.keys(FREQUENCIES) as [string, ...string[]]), recipients: z.string().trim().min(3, "Add at least one e-mail address."), owner: z.string().optional(), property: z.string().optional() })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  if (!reportById(p.data.report_key)?.run) return { error: "That report can't be scheduled yet." };
  const emails = p.data.recipients.split(/[,;\s]+/).filter(Boolean);
  if (emails.length > 20 || emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) return { error: "Check the e-mail addresses (up to 20, separated by commas)." };
  const { error } = await supabase.from("scheduled_report").insert({
    company_id: company.id,
    report_key: p.data.report_key,
    frequency: p.data.frequency,
    format: "csv",
    scope: { owner: p.data.owner || undefined, property: p.data.property || undefined },
    recipients: emails.map((email) => ({ type: "email", email })),
  });
  if (error) return { error: error.message };
  revalidatePath("/reports");
  return { message: `Scheduled: ${FREQUENCIES[p.data.frequency].toLowerCase()} to ${emails.join(", ")}.` };
}

export async function setSchedule(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  if (form.get("op") === "delete") await supabase.from("scheduled_report").delete().eq("id", id.data).eq("company_id", company.id);
  else await supabase.from("scheduled_report").update({ active: form.get("op") === "resume" }).eq("id", id.data).eq("company_id", company.id);
  revalidatePath("/reports");
}
