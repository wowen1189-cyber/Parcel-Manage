"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildLedger } from "@/lib/ledger";
import { claimDeadlines, depositHeldCents, settlement } from "@/lib/deposits";
import { todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export type MoveOutState = { error?: string; message?: string; values?: Record<string, string> };
const ROLES = ["admin", "property_manager", "accountant"];
const typed = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date.");

function refresh(leaseId: string) {
  revalidatePath(`/tenants/${leaseId}`);
  revalidatePath(`/tenants/${leaseId}/move-out`);
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
}

/** The tenant moved out: end the lease, free the unit, and start the 83.49 deposit clock. */
export async function startMoveOut(_: MoveOutState, form: FormData): Promise<MoveOutState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't record move-outs." };
  const p = z.object({ lease_id: z.string().uuid(), vacated_on: day, forwarding_address: z.string().trim().max(300).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const { data: l } = await supabase.from("lease").select("id, unit_id").eq("id", p.data.lease_id).eq("company_id", company.id).maybeSingle();
  if (!l) return { error: "Lease not found." };
  const { error } = await supabase.from("move_out").insert({ company_id: company.id, lease_id: l.id, vacated_on: p.data.vacated_on, forwarding_address: p.data.forwarding_address || null, created_by: user.id });
  if (error) return { error: error.code === "23505" ? "Move-out already started." : error.message };
  await supabase.from("lease").update({ status: "ended", move_out_on: p.data.vacated_on }).eq("id", l.id).eq("company_id", company.id);
  // Free the unit unless another lease is already active there.
  const { data: other } = await supabase.from("lease").select("id").eq("unit_id", l.unit_id).eq("status", "active").neq("id", l.id).limit(1);
  if (!other?.length) await supabase.from("unit").update({ status: "vacant" }).eq("id", l.unit_id).eq("company_id", company.id);
  refresh(l.id);
  return { message: "Move-out recorded. The deposit deadlines below have started." };
}

/** Inspection notes and the list of deductions (damage beyond normal wear, cleaning, unpaid charges). */
export async function saveDeductions(_: MoveOutState, form: FormData): Promise<MoveOutState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't change move-outs." };
  const id = z.string().uuid().safeParse(form.get("move_out_id"));
  if (!id.success) return { error: "Move-out not found." };
  const rows: { description: string; amount_cents: number }[] = [];
  for (let i = 0; i < 15; i++) {
    const description = String(form.get(`desc_${i}`) ?? "").trim();
    const raw = String(form.get(`amount_${i}`) ?? "").replace(/[$,\s]/g, "");
    if (!description && !raw) continue;
    if (!description) return { error: `Describe deduction ${i + 1}.`, values: typed(form) };
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || !Number(raw)) return { error: `Enter the amount for "${description}".`, values: typed(form) };
    rows.push({ description: description.slice(0, 200), amount_cents: Math.round(Number(raw) * 100) });
  }
  const { data: mo } = await supabase.from("move_out").select("id, lease_id, decision").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!mo) return { error: "Move-out not found." };
  if (mo.decision) return { error: "The deposit decision is already made; deductions can't change now." };
  await supabase.from("move_out").update({ deductions: rows, inspection_notes: String(form.get("inspection_notes") ?? "").trim().slice(0, 4000) || null }).eq("id", mo.id);
  refresh(mo.lease_id);
  return { message: "Saved." };
}

/**
 * Claim against the deposit: post each deduction to the tenant's ledger as a move-out charge (once). The
 * claim notice is then written in Communications and sent by certified mail (or e-mail under 83.505).
 */
export async function claimDeposit(_: MoveOutState, form: FormData): Promise<MoveOutState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't change move-outs." };
  const id = z.string().uuid().safeParse(form.get("move_out_id"));
  if (!id.success) return { error: "Move-out not found." };
  const { data: mo } = await supabase.from("move_out").select("id, lease_id, vacated_on, decision, deductions").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!mo || mo.decision) return { error: "The deposit decision is already made." };
  const deductions = mo.deductions as { description: string; amount_cents: number }[];
  for (const d of deductions) {
    const { error } = await supabase.rpc("post_charge", { p_lease: mo.lease_id, p_type: "move_out", p_description: `Move-out: ${d.description}`, p_amount: d.amount_cents, p_due: mo.vacated_on });
    if (error) return { error: error.message };
  }
  await supabase.from("move_out").update({ decision: "claim", created_by: user.id }).eq("id", mo.id);
  refresh(mo.lease_id);
  return { message: "Deductions posted. Now send the claim notice." };
}

/** Record that the claim notice went out (the letter itself is filed from Communications). */
export async function recordClaimNotice(_: MoveOutState, form: FormData): Promise<MoveOutState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't change move-outs." };
  const p = z.object({ move_out_id: z.string().uuid(), sent_on: day, method: z.enum(["certified_mail", "email_addendum"]), message_id: z.string().optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: mo } = await supabase.from("move_out").select("id, lease_id").eq("id", p.data.move_out_id).eq("company_id", company.id).maybeSingle();
  if (!mo) return { error: "Move-out not found." };
  await supabase.from("move_out").update({ claim_notice_sent_on: p.data.sent_on, claim_notice_method: p.data.method, claim_notice_message_id: z.string().uuid().safeParse(p.data.message_id).success ? p.data.message_id : null }).eq("id", mo.id);
  refresh(mo.lease_id);
  return { message: "Recorded." };
}

export async function recordObjection(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return;
  const p = z.object({ move_out_id: z.string().uuid(), received_on: day }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { data: mo } = await supabase.from("move_out").select("lease_id").eq("id", p.data.move_out_id).eq("company_id", company.id).maybeSingle();
  await supabase.from("move_out").update({ objection_received_on: p.data.received_on }).eq("id", p.data.move_out_id).eq("company_id", company.id);
  if (mo) refresh(mo.lease_id);
}

/** Settle the deposit: apply to the balance (after a claim) and refund the rest from trust. Closes the move-out. */
export async function settleDeposit(_: MoveOutState, form: FormData): Promise<MoveOutState> {
  const { supabase, company, membership } = await requireCompany();
  if (!["admin", "accountant", "property_manager"].includes(membership.role)) return { error: "Your role can't settle deposits." };
  const p = z.object({ move_out_id: z.string().uuid(), paid_on: day, reference: z.string().trim().max(60).optional(), decision: z.enum(["return_full", "claim"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: mo } = await supabase
    .from("move_out")
    .select("id, lease_id, decision, closed_at, claim_notice_sent_on, claim_notice_method, objection_received_on, lease(opening_balance_cents, opening_balance_as_of, charge(id, charge_type, description, amount_cents, due_date, created_at), payment(id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at))")
    .eq("id", p.data.move_out_id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!mo || mo.closed_at) return { error: "Already settled." };
  if (p.data.decision === "claim" && !mo.claim_notice_sent_on) return { error: "Send the claim notice and record it first (83.49(3)(a))." };
  if (p.data.decision === "claim" && mo.claim_notice_sent_on && !mo.objection_received_on) {
    // 83.49(3)(b): the deduction may be made only if the tenant hasn't objected within 15 days of receiving the notice.
    const { objectionEnds } = claimDeadlines(mo.claim_notice_sent_on, (mo.claim_notice_method ?? "certified_mail") as "certified_mail" | "email_addendum");
    if (todayIn(company.time_zone) <= objectionEnds) return { error: `Wait until the tenant's objection window closes (about ${objectionEnds}) before deducting (83.49(3)(b)).` };
  }
  const held = depositHeldCents(mo.lease.payment, 0);
  const owed = Math.max(0, buildLedger(mo.lease.charge, mo.lease.payment, { cents: mo.lease.opening_balance_cents, asOf: mo.lease.opening_balance_as_of }).balanceCents);
  const s = settlement(held, owed, p.data.decision === "claim");
  if (s.applyCents || s.refundCents) {
    const { error } = await supabase.rpc("settle_deposit", { p_lease: mo.lease_id, p_apply: s.applyCents, p_refund: s.refundCents, p_date: p.data.paid_on, p_reference: p.data.reference || undefined });
    if (error) return { error: error.message };
  }
  await supabase.from("move_out").update({ decision: p.data.decision, refund_cents: s.refundCents, refund_paid_on: p.data.paid_on, refund_reference: p.data.reference || null, closed_at: new Date().toISOString() }).eq("id", mo.id);
  refresh(mo.lease_id);
  return { message: s.stillOwedCents ? `Settled. The tenant still owes ${(s.stillOwedCents / 100).toFixed(2)} after the deposit.` : "Settled." };
}
