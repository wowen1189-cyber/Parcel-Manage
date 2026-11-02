"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdmin, requireCompany } from "@/lib/session";
import { previousSoftware } from "@/lib/switch-over";

/** Steps only a person can confirm (parallel run, owner sign-off, old software canceled). */
export async function toggleStep(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return;
  const step = z.enum(["parallel_run", "owner_signoff", "tenants_told", "appfolio_canceled"]).safeParse(form.get("step"));
  if (!step.success) return;
  const settings = company.settings && typeof company.settings === "object" && !Array.isArray(company.settings) ? (company.settings as Record<string, unknown>) : {};
  const done = { ...((settings.switchOver as Record<string, string | null>) ?? {}) };
  done[step.data] = done[step.data] ? null : new Date().toISOString().slice(0, 10);
  await supabase.from("company").update({ settings: { ...settings, switchOver: done } }).eq("id", company.id);
  revalidatePath("/switch-over");
}

/** Records which software the company is leaving (switchOver.from); the checklist uses its name. */
export async function setPreviousSoftware(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return;
  const settings = company.settings && typeof company.settings === "object" && !Array.isArray(company.settings) ? (company.settings as Record<string, unknown>) : {};
  const choice = String(form.get("choice") ?? "");
  const from = previousSoftware({ switchOver: { from: choice === "__other" ? form.get("other") : choice } });
  await supabase.from("company").update({ settings: { ...settings, switchOver: { ...((settings.switchOver as Record<string, unknown>) ?? {}), from } } }).eq("id", company.id);
  revalidatePath("/switch-over");
  revalidatePath("/settings/billing");
}
