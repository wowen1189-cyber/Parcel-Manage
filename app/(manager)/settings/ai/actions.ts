"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiComplete } from "@/lib/ai/provider";
import { isAdmin, requireCompany } from "@/lib/session";

export type AiState = { error?: string; message?: string };

/** Save the provider, model and limit, and the key if one was typed (it's never shown again). Then test it. */
export async function saveAiConnection(_: AiState, form: FormData): Promise<AiState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: "Only an admin can change the AI connection." };
  const p = z
    .object({
      provider: z.enum(["anthropic", "openai", "google", "openai_compatible"]),
      model: z.string().trim().min(2, "Choose or type a model.").max(80),
      base_url: z.string().trim().max(200).optional(),
      limit: z.string().trim().transform((v) => Math.round(Number(v.replace(/[$,\s]/g, "")) * 100)).refine((v) => v >= 0 && v <= 1_000_000, "Enter a monthly limit in dollars."),
      key: z.string().trim().max(400).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.provider === "openai_compatible" && !/^https:\/\//.test(p.data.base_url ?? "")) return { error: "Enter the provider's https:// address." };
  const { error } = await supabase.from("ai_connection").upsert({ company_id: company.id, provider: p.data.provider, model: p.data.model, base_url: p.data.provider === "openai_compatible" ? p.data.base_url! : null, monthly_limit_cents: p.data.limit, status: "untested" });
  if (error) return { error: error.message };
  if (p.data.key) {
    const { error: kErr } = await supabase.rpc("set_ai_key", { p_company: company.id, p_key: p.data.key });
    if (kErr) return { error: kErr.message };
  }
  const test = await aiComplete({ companyId: company.id, feature: "connection_test", system: "You are a connection test.", prompt: "Reply with the single word OK.", maxTokens: 10, timeoutMs: 15_000, test: true });
  await supabase.from("ai_connection").update({ status: test.ok ? "ok" : "error", tested_at: new Date().toISOString() }).eq("company_id", company.id);
  revalidatePath("/settings/ai");
  return test.ok ? { message: "Connected. AI features are on." } : { error: `Saved, but the test failed: ${test.reason}` };
}

export async function disconnectAi(): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return;
  await supabase.rpc("clear_ai_connection", { p_company: company.id });
  revalidatePath("/settings/ai");
}
