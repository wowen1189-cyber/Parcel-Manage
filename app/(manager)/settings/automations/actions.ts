"use server";

import { revalidatePath } from "next/cache";
import { automationSettingsSchema } from "@/lib/automation-rules";
import { runAutomations } from "@/lib/automations";
import { todayIn } from "@/lib/format";
import { isAdmin, requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type AutomationState = { error?: string; message?: string };

export async function saveAutomations(_: AutomationState, form: FormData): Promise<AutomationState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: "Only an admin can change automations." };
  const on = (k: string) => form.get(k) === "on";
  const p = automationSettingsSchema.safeParse({
    enabled: on("enabled"),
    rentReminders: on("rentReminders"),
    rentReminderDaysBefore: form.get("rentReminderDaysBefore"),
    lateNoticeTasks: on("lateNoticeTasks"),
    renewalTasks: on("renewalTasks"),
    insuranceReminders: on("insuranceReminders"),
    insuranceReminderDays: form.get("insuranceReminderDays"),
    visitReminders: on("visitReminders"),
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const settings = company.settings && typeof company.settings === "object" && !Array.isArray(company.settings) ? company.settings : {};
  const { error } = await supabase.from("company").update({ settings: { ...settings, automations: p.data } }).eq("id", company.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/automations");
  return { message: p.data.enabled ? "Saved. Automations run every morning." : "Saved. Automations are off." };
}

/** Run today's automations now (the daily job does this automatically). Each one still runs only once. */
export async function runAutomationsNow(): Promise<AutomationState> {
  const { company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: "Only an admin can run automations." };
  const c = await runAutomations(createAdminClient(), company, todayIn(company.time_zone));
  revalidatePath("/tasks");
  const sent = c.rentReminders + c.insuranceReminders + c.visitReminders;
  const tasks = c.lateNoticeTasks + c.preNoticeTasks + c.renewalTasks + c.entryTasks;
  return { message: `Sent ${sent} reminder${sent === 1 ? "" : "s"} and added ${tasks} task${tasks === 1 ? "" : "s"} to To do.` };
}
