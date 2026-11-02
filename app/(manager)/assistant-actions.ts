"use server";

import { z } from "zod";
import { approvals, askAssistant, type Approval } from "@/lib/ai/assistant";
import { todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export async function loadApprovals(): Promise<Approval[]> {
  const { supabase, company } = await requireCompany();
  return approvals(supabase, company, todayIn(company.time_zone));
}

export async function askAi(question: string): Promise<{ answer?: string; error?: string }> {
  const q = z.string().trim().min(3, "Type a question.").max(1000, "Keep the question under 1,000 characters.").safeParse(question);
  if (!q.success) return { error: q.error.issues[0].message };
  const { supabase, company } = await requireCompany();
  const r = await askAssistant(supabase, company, todayIn(company.time_zone), q.data);
  if (r.ok) return { answer: r.answer };
  return { error: r.reason === "No AI connection." ? "Connect your AI provider in Settings › AI connection to ask questions." : `The assistant couldn't answer: ${r.reason}` };
}
