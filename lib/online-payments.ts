import "server-only";
import { sendReceipt } from "@/lib/receipts";
import type { createAdminClient } from "@/lib/supabase/admin";

/** Records a cleared online payment once (by Stripe reference) and e-mails the receipt. Returns an error message. */
export async function recordOnline(db: ReturnType<typeof createAdminClient>, companyId: string, leaseId: string, method: "ach" | "card", amount: number, ref: string, fee: number, label: string) {
  const { data: existing } = await db.from("payment").select("id").eq("company_id", companyId).eq("processor_ref", ref).maybeSingle();
  if (existing) return null;
  const { data: paymentId, error } = await db.rpc("record_payment", { p_lease: leaseId, p_method: method, p_amount: amount, p_received: new Date().toISOString().slice(0, 10), p_reference: label });
  if (error) return error.message;
  await db.from("payment").update({ processor_ref: ref, fee_cents: fee }).eq("id", paymentId as string);
  await sendReceipt(db, companyId, paymentId as string);
  return null;
}
