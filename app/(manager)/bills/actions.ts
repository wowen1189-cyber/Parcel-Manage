"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCompany } from "@/lib/session";
import { canPay } from "@/lib/vendor-requests";

// Bills: vendor invoices. Approving posts the expense and payable to the owner's books (a person approves:
// CLAUDE.md rule 4); paying posts payable against operating cash. A 1099 vendor without a W-9 can't be paid.

export type BillState = { error?: string; message?: string; values?: Record<string, string> };
const APPROVE_ROLES = ["admin", "property_manager", "accountant"];
const PAY_ROLES = ["admin", "accountant"];
const typed = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
const dollars = z
  .string()
  .trim()
  .transform((v) => v.replace(/[$,\s]/g, ""))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Enter the amount, like 245.00.")
  .transform((v) => Math.round(Number(v) * 100));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date.");

function refresh(id?: string) {
  revalidatePath("/bills");
  revalidatePath("/accounting");
  if (id) revalidatePath(`/bills/${id}`);
}

export async function createBill(_: BillState, form: FormData): Promise<BillState> {
  const { supabase, company, membership } = await requireCompany();
  if (!APPROVE_ROLES.includes(membership.role)) return { error: "Your role can't enter bills.", values: typed(form) };
  const p = z
    .object({
      vendor_id: z.string().uuid("Choose the vendor."),
      property_id: z.string().uuid("Choose the property."),
      amount: dollars,
      invoice_number: z.string().trim().max(60).optional(),
      invoice_date: day,
      due_date: day,
      expense_account: z.string().regex(/^\d{4}$/, "Choose the expense account."),
      memo: z.string().trim().max(300).optional(),
      purchase_order_id: z.union([z.literal(""), z.string().uuid()]).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  // A bill tied to a purchase order must be from that PO's vendor for that property; it then counts toward the PO's project.
  let po: { id: string; project_id: string | null } | null = null;
  if (p.data.purchase_order_id) {
    const { data } = await supabase.from("purchase_order").select("id, vendor_id, property_id, project_id, status").eq("id", p.data.purchase_order_id).eq("company_id", company.id).maybeSingle();
    if (!data || data.status !== "approved") return { error: "That purchase order isn't approved.", values: typed(form) };
    if (data.vendor_id !== p.data.vendor_id || data.property_id !== p.data.property_id) return { error: "That purchase order is for a different vendor or property.", values: typed(form) };
    po = data;
  }
  const { data: property } = await supabase.from("property").select("id, entity_id").eq("id", p.data.property_id).eq("company_id", company.id).maybeSingle();
  if (!property) return { error: "Property not found.", values: typed(form) };
  const { data: bill, error } = await supabase
    .from("bill")
    .insert({ company_id: company.id, entity_id: property.entity_id, vendor_id: p.data.vendor_id, property_id: property.id, amount_cents: p.data.amount, invoice_number: p.data.invoice_number || null, invoice_date: p.data.invoice_date, due_date: p.data.due_date, expense_account: p.data.expense_account, memo: p.data.memo || null, source: "manual", purchase_order_id: po?.id ?? null, project_id: po?.project_id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message, values: typed(form) };
  refresh();
  redirect(`/bills/${bill.id}?added=1`);
}

/** Approve: post the expense and the payable (amount and account can be corrected before approving). */
export async function approveBill(_: BillState, form: FormData): Promise<BillState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!APPROVE_ROLES.includes(membership.role)) return { error: "Your role can't approve bills." };
  const p = z.object({ id: z.string().uuid(), amount: dollars, expense_account: z.string().regex(/^\d{4}$/), due_date: day }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: bill } = await supabase.from("bill").select("id, status, entity_id, property_id, unit_id, memo, invoice_number, vendor(contact(first_name, last_name, business_name, kind))").eq("id", p.data.id).eq("company_id", company.id).maybeSingle();
  if (!bill) return { error: "Bill not found." };
  if (bill.status !== "received") return { error: "This bill was already approved." };
  if (!bill.vendor) return { error: "Choose the vendor first (Correct the details)." };
  if (!bill.entity_id) return { error: "Choose the property first so it posts to the right owner's books." };
  const vendor = bill.vendor ? [bill.vendor.contact.business_name, bill.vendor.contact.first_name, bill.vendor.contact.last_name].filter(Boolean).join(" ") : "Vendor";
  const memo = `${vendor}${bill.invoice_number ? ` invoice ${bill.invoice_number}` : ""}${bill.memo ? `: ${bill.memo}` : ""}`;
  const { data: entry, error } = await supabase.rpc("post_journal_entry", {
    p_company: company.id,
    p_entity: bill.entity_id,
    p_date: new Date().toISOString().slice(0, 10),
    p_memo: memo,
    p_source: "bill",
    p_lines: [
      { account: p.data.expense_account, debit: p.data.amount, property_id: bill.property_id ?? "", unit_id: bill.unit_id ?? "" },
      { account: "2000", credit: p.data.amount, property_id: bill.property_id ?? "" },
    ],
  });
  if (error) return { error: error.message };
  await supabase.from("bill").update({ status: "approved", amount_cents: p.data.amount, expense_account: p.data.expense_account, due_date: p.data.due_date, approved_by: user.id, approved_at: new Date().toISOString(), journal_entry_id: entry }).eq("id", bill.id);
  refresh(bill.id);
  return { message: "Approved and posted to the owner's books." };
}

/** Correct a bill that's still waiting for approval (an e-mailed invoice the AI read wrong, for example). */
export async function editBill(_: BillState, form: FormData): Promise<BillState> {
  const { supabase, company, membership } = await requireCompany();
  if (!APPROVE_ROLES.includes(membership.role)) return { error: "Your role can't change bills." };
  const p = z
    .object({
      id: z.string().uuid(),
      vendor_id: z.string().uuid("Choose the vendor."),
      property_id: z.string().uuid("Choose the property."),
      work_order: z.union([z.literal(""), z.string().regex(/^#?\d{1,7}$/, "Enter the work order number, like 1042.")]),
      invoice_number: z.string().trim().max(60),
      invoice_date: day,
      memo: z.string().trim().max(300),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: bill } = await supabase.from("bill").select("id, status, review_notes").eq("id", p.data.id).eq("company_id", company.id).maybeSingle();
  if (!bill) return { error: "Bill not found." };
  if (bill.status !== "received") return { error: "Only a bill waiting for approval can be changed. Void it instead." };
  const [{ data: property }, { data: vendor }] = await Promise.all([
    supabase.from("property").select("id, entity_id").eq("id", p.data.property_id).eq("company_id", company.id).maybeSingle(),
    supabase.from("vendor").select("id").eq("id", p.data.vendor_id).eq("company_id", company.id).maybeSingle(),
  ]);
  if (!property || !vendor) return { error: "Choose the vendor and property again." };
  let workOrderId: string | null = null;
  if (p.data.work_order) {
    const { data: wo } = await supabase.from("work_order").select("id, property_id").eq("company_id", company.id).eq("number", Number(p.data.work_order.replace("#", ""))).maybeSingle();
    if (!wo) return { error: `There's no work order #${p.data.work_order.replace("#", "")}.` };
    if (wo.property_id !== property.id) return { error: "That work order is for a different property." };
    workOrderId = wo.id;
  }
  const { error } = await supabase
    .from("bill")
    .update({ vendor_id: vendor.id, property_id: property.id, entity_id: property.entity_id, work_order_id: workOrderId, invoice_number: p.data.invoice_number || null, invoice_date: p.data.invoice_date, memo: p.data.memo || null, review_notes: bill.review_notes.filter((n) => !/^(Vendor|Property) not identified/.test(n)) })
    .eq("id", bill.id);
  if (error) return { error: error.message };
  refresh(bill.id);
  return { message: "Saved." };
}

/** Record payment of an approved bill (check, ACH or card paid outside Parcel Manage for now). */
export async function payBill(_: BillState, form: FormData): Promise<BillState> {
  const { supabase, company, membership } = await requireCompany();
  if (!PAY_ROLES.includes(membership.role)) return { error: "Only an admin or accountant can pay bills." };
  const p = z.object({ id: z.string().uuid(), paid_on: day, payment_method: z.enum(["check", "ach", "card", "other"]), payment_reference: z.string().trim().max(60).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: bill } = await supabase.from("bill").select("id, status, entity_id, property_id, amount_cents, invoice_number, vendor_id, vendor(w9_on_file, is_1099, contact(first_name, last_name, business_name))").eq("id", p.data.id).eq("company_id", company.id).maybeSingle();
  if (!bill) return { error: "Bill not found." };
  if (bill.status !== "approved") return { error: "Approve the bill before paying it." };
  if (bill.vendor && !canPay(bill.vendor)) return { error: "This vendor can't be paid until their W-9 is on file. Send them a paperwork request from their vendor page." };
  const vendor = bill.vendor ? [bill.vendor.contact.business_name, bill.vendor.contact.first_name, bill.vendor.contact.last_name].filter(Boolean).join(" ") : "Vendor";
  const { data: entry, error } = await supabase.rpc("post_journal_entry", {
    p_company: company.id,
    p_entity: bill.entity_id!,
    p_date: p.data.paid_on,
    p_memo: `Paid ${vendor}${bill.invoice_number ? ` invoice ${bill.invoice_number}` : ""}${p.data.payment_reference ? ` (${p.data.payment_reference})` : ""}`,
    p_source: "bill",
    p_lines: [
      { account: "2000", debit: bill.amount_cents, property_id: bill.property_id ?? "" },
      { account: "1000", credit: bill.amount_cents, property_id: bill.property_id ?? "" },
    ],
  });
  if (error) return { error: error.message };
  await supabase.from("bill").update({ status: "paid", paid_on: p.data.paid_on, payment_method: p.data.payment_method, payment_reference: p.data.payment_reference || null, paid_entry_id: entry }).eq("id", bill.id);
  if (bill.vendor_id) await supabase.from("vendor").update({ last_paid_on: p.data.paid_on }).eq("id", bill.vendor_id).eq("company_id", company.id);
  refresh(bill.id);
  return { message: "Payment recorded." };
}

/** Void: a received bill is simply voided; an approved one has its posting reversed. Paid bills can't be voided. */
export async function voidBill(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!APPROVE_ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const { data: bill } = await supabase.from("bill").select("id, status, journal_entry_id").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!bill || bill.status === "paid" || bill.status === "void") return;
  if (bill.journal_entry_id) await supabase.rpc("reverse_journal_entry", { p_entry: bill.journal_entry_id, p_date: new Date().toISOString().slice(0, 10), p_memo: "Bill voided" });
  await supabase.from("bill").update({ status: "void" }).eq("id", bill.id);
  refresh(bill.id);
}
