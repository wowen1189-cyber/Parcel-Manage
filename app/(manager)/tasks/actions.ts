"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany } from "@/lib/session";

export async function closeTask(form: FormData): Promise<void> {
  const { supabase, company, user } = await requireCompany();
  const p = z.object({ id: z.string().uuid(), status: z.enum(["done", "dismissed", "open"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await supabase
    .from("automation_task")
    .update({ status: p.data.status, done_at: p.data.status === "open" ? null : new Date().toISOString(), done_by: p.data.status === "open" ? null : user.id })
    .eq("id", p.data.id)
    .eq("company_id", company.id)
    .neq("status", "sent");
  revalidatePath("/tasks");
}
