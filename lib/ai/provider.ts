import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostCents, type Provider } from "./models";

// One call to the company's own AI provider. Every AI feature goes through here so the monthly spending
// limit and usage log apply, and every feature degrades gracefully: with no key, a paused connection, an
// error or a timeout, it returns { ok: false } and the app uses its non-AI fallback.

export type AiResult = { ok: true; text: string } | { ok: false; reason: string };

export async function monthSpendCents(companyId: string): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await createAdminClient().from("ai_usage").select("cost_estimate_cents").eq("company_id", companyId).gte("created_at", start.toISOString());
  return (data ?? []).reduce((s, r) => s + (r.cost_estimate_cents ?? 0), 0);
}

async function call(provider: Provider, model: string, key: string, baseUrl: string | null, system: string, prompt: string, maxTokens: number, signal: AbortSignal) {
  if (provider === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? `Anthropic error ${r.status}`);
    return { text: (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join(""), input: j.usage?.input_tokens ?? 0, output: j.usage?.output_tokens ?? 0 };
  }
  if (provider === "google") {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal,
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? `Gemini error ${r.status}`);
    return { text: (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join(""), input: j.usageMetadata?.promptTokenCount ?? 0, output: j.usageMetadata?.candidatesTokenCount ?? 0 };
  }
  const base = (provider === "openai" ? "https://api.openai.com" : (baseUrl ?? "")).replace(/\/+$/, "");
  if (!base) throw new Error("Add the provider's address (base URL).");
  const r = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    signal,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, max_completion_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `AI provider error ${r.status}`);
  return { text: j.choices?.[0]?.message?.content ?? "", input: j.usage?.prompt_tokens ?? 0, output: j.usage?.completion_tokens ?? 0 };
}

export async function aiComplete(input: { companyId: string; feature: string; system: string; prompt: string; maxTokens?: number; timeoutMs?: number; test?: boolean }): Promise<AiResult> {
  const db = createAdminClient();
  const { data: conn } = await db.from("ai_connection").select("provider, model, base_url, monthly_limit_cents, status").eq("company_id", input.companyId).maybeSingle();
  if (!conn) return { ok: false, reason: "No AI connection." };
  if (!input.test && conn.status !== "ok") return { ok: false, reason: "The AI connection hasn't passed its test." };
  const spent = await monthSpendCents(input.companyId);
  if (spent >= conn.monthly_limit_cents) {
    if (conn.status === "ok") await db.from("ai_connection").update({ status: "paused_limit" }).eq("company_id", input.companyId);
    return { ok: false, reason: "This month's AI spending limit is reached." };
  }
  const { data: key } = await db.rpc("ai_key_for", { p_company: input.companyId });
  if (!key) return { ok: false, reason: "No AI key saved." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 20_000);
  try {
    const r = await call(conn.provider as Provider, conn.model, key, conn.base_url, input.system, input.prompt, input.maxTokens ?? 600, controller.signal);
    await db.from("ai_usage").insert({ company_id: input.companyId, feature: input.feature, input_tokens: r.input, output_tokens: r.output, cost_estimate_cents: estimateCostCents(conn.model, r.input, r.output) });
    return r.text.trim() ? { ok: true, text: r.text.trim() } : { ok: false, reason: "The AI returned nothing." };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? (e.name === "AbortError" ? "The AI took too long." : e.message) : "AI error." };
  } finally {
    clearTimeout(timer);
  }
}
