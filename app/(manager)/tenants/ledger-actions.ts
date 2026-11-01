"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CHARGE_TYPES, PAYMENT_METHODS } from "@/lib/ledger";
import { requireCompany } from "@/lib/session";

// Ledger changes: each one posts a balanced journal entry through the database functions in
// 0015_accounting.sql. Nothing is edited after posting; mistakes are fixed by returning or reversing.

export type LedgerState = { error?: string; message?: string; values?: Record<string, string> };

const MONEY_ROLES = ["admin", "property_manager", "accountant", "leasing_agent"];
const NOT_ALLOWED = "Your role can't post to tenant ledgers.";
const cents = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[$,\s]/g, ""))
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, `Enter ${label} as a dollar amount, like 1250 or 1250.00.`)
    .transform((v) => Math.round(Number(v) * 100));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date.");
const typed = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

function refresh(leaseId: string) {
  revalidatePath(`/tenants/${leaseId}`);
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
}

export async function recordPayment(_: LedgerState, form: FormData): Promise<LedgerState> {
  const { supabase, membership } = await requireCompany();
  if (!MONEY_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = z
    .object({
      lease_id: z.string().uuid(),
      purpose: z.enum(["rent", "deposit"]),
      method: z.enum(Object.keys(PAYMENT_METHODS) as [string, ...string[]]),
      amount: cents("the amount"),
      received_on: day,
      reference: z.string().trim().max(60).optional(),
      memo: z.string().trim().max(300).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const d = parsed.data;
  const { error } = await supabase.rpc("record_payment", {
    p_lease: d.lease_id,
    p_method: d.method,
    p_amount: d.amount,
    p_received: d.received_on,
    p_purpose: d.purpose,
    p_reference: d.reference || undefined,
    p_memo: d.memo || undefined,
  });
  if (error) return { error: error.message, values: typed(form) };
  refresh(d.lease_id);
  return { message: d.purpose === "deposit" ? "Deposit recorded and held in trust." : "Payment recorded." };
}

export async function addCharge(_: LedgerState, form: FormData): Promise<LedgerState> {
  const { supabase, membership } = await requireCompany();
  if (!MONEY_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = z
    .object({
      lease_id: z.string().uuid(),
      charge_type: z.enum(Object.keys(CHARGE_TYPES).filter((k) => k !== "opening_balance") as [string, ...string[]]),
      description: z.string().trim().min(2, "Describe the charge.").max(120),
      amount: cents("the amount"),
      due_date: day,
      memo: z.string().trim().max(300).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const d = parsed.data;
  const { error } = await supabase.rpc("post_charge", { p_lease: d.lease_id, p_type: d.charge_type, p_description: d.description, p_amount: d.amount, p_due: d.due_date, p_memo: d.memo || undefined });
  if (error) return { error: error.message, values: typed(form) };
  refresh(d.lease_id);
  return { message: "Charge posted." };
}

/** A check bounced or an ACH came back: reverse it and charge the lease's returned-payment fee. */
export async function returnPayment(_: LedgerState, form: FormData): Promise<LedgerState> {
  const { supabase, company, membership } = await requireCompany();
  if (!MONEY_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = z.object({ payment_id: z.string().uuid(), returned_on: day, charge_fee: z.literal("on").optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data: pay } = await supabase.from("payment").select("id, lease_id, lease(nsf_fee_cents)").eq("id", parsed.data.payment_id).eq("company_id", company.id).maybeSingle();
  if (!pay) return { error: "Payment not found." };
  // The fee is only charged when the lease sets one (Fla. Stat. 83.43; amount limits in 68.065).
  const fee = parsed.data.charge_fee ? (pay.lease.nsf_fee_cents ?? 0) : 0;
  const { error } = await supabase.rpc("return_payment", { p_payment: pay.id, p_date: parsed.data.returned_on, p_fee: fee });
  if (error) return { error: error.message };
  refresh(pay.lease_id);
  return { message: fee ? "Payment returned and the returned-payment fee charged." : "Payment returned." };
}
