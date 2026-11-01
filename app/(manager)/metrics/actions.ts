"use server";

import { revalidatePath } from "next/cache";
import { METRICS } from "@/lib/metrics-defs";
import { isAdmin, requireCompany } from "@/lib/session";

export type TargetState = { error?: string; message?: string };

/** Targets are typed the way they're shown: percents as 95, money as dollars. */
export async function saveTargets(_: TargetState, form: FormData): Promise<TargetState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: "Only an admin can change targets." };
  const rows = [];
  for (const m of METRICS) {
    const raw = String(form.get(`t_${m.key}`) ?? "").replace(/[$,%\s]/g, "");
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 0) return { error: `${m.label}: enter a number.` };
    const target = m.unit === "percent" ? n / 100 : m.unit === "money" ? Math.round(n * 100) : n;
    rows.push({ company_id: company.id, metric_key: m.key, target, alert: form.get(`a_${m.key}`) === "on" });
  }
  const { error } = await supabase.from("metric_target").upsert(rows, { onConflict: "company_id,metric_key" });
  if (error) return { error: error.message };
  revalidatePath("/metrics");
  return { message: "Targets saved." };
}
