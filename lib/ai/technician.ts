import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiComplete } from "./provider";

// AI technician summary: turns the triage answers into a short, plain brief for the vendor. Runs after the
// request is saved; if AI isn't connected or fails, the rule-based summary already on the work order stays.
export async function improveTechnicianSummary(companyId: string, workOrderId: string) {
  const db = createAdminClient();
  const { data: wo } = await db.from("work_order").select("title, priority, ai_summary, room, tenant_note").eq("id", workOrderId).eq("company_id", companyId).maybeSingle();
  if (!wo?.ai_summary) return;
  const r = await aiComplete({
    companyId,
    feature: "technician_summary",
    system:
      "You write work order briefs for licensed repair technicians at rental properties in Florida. Use only the facts given. Plain sentences, no headings, under 90 words. Start with the priority. Name the likely cause only if the facts support it. Never invent measurements, access details or tenant statements.",
    prompt: `Work order: ${wo.title}\nPriority: ${wo.priority}\nFacts from the tenant's answers: ${wo.ai_summary}${wo.room ? `\nRoom: ${wo.room}` : ""}${wo.tenant_note ? `\nTenant note: ${wo.tenant_note}` : ""}`,
    maxTokens: 220,
    timeoutMs: 15_000,
  });
  if (r.ok) await db.from("work_order").update({ ai_summary: `${r.text}\n\n(From the triage answers: ${wo.ai_summary})` }).eq("id", workOrderId).eq("company_id", companyId);
}
