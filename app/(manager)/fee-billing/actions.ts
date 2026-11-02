"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailHtml, emailText } from "@/lib/email/layout";
import { approvalEntries, canBill, FEE_KIND_LABEL, feeTotal, paymentEntries, type FeeLine } from "@/lib/fee-billing";
import { managerEntity, ownerMonthFees } from "@/lib/fee-billing-data";
import { money, todayIn } from "@/lib/format";
import { letterPdf } from "@/lib/letter-pdf";
import { requireCompany } from "@/lib/session";

// Billing out management fees: one bill per owner per month from the management company's books. A draft
// changes nothing; approving (a person, CLAUDE.md rule 4) posts it on both sets of books; paying moves cash.

export type FeeState = { error?: string; message?: string };
const ROLES = ["admin", "accountant"];
const month = z.string().regex(/^\d{4}-\d{2}$/, "Choose the month.");

/** Set up the management company's own books (the account fees are paid into). */
export async function setUpManager(_: FeeState, form: FormData): Promise<FeeState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Only an admin or accountant can set this up." };
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter the management company's name." };
  if (await managerEntity(supabase, company.id)) return { error: "Already set up." };
  const { error } = await supabase.from("entity").insert({ company_id: company.id, name, entity_type: "Management company", is_manager: true, books_mode: "own_books" });
  if (error) return { error: error.message };
  revalidatePath("/fee-billing");
  return { message: "Set up. Add its bank account under Bank accounts." };
}

/** Make draft bills for every owner with fees this month that doesn't have one yet. */
export async function createFeeBills(_: FeeState, form: FormData): Promise<FeeState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Only an admin or accountant can bill fees." };
  const m = month.safeParse(form.get("month"));
  if (!m.success) return { error: m.error.issues[0].message };
  if (!canBill(m.data, todayIn(company.time_zone))) return { error: "You can bill a month once it has ended." };
  const manager = await managerEntity(supabase, company.id);
  if (!manager) return { error: "Set up the management company's books first." };
  const [{ data: owners }, { data: existing }, { data: last }] = await Promise.all([
    supabase.from("entity").select("id").eq("company_id", company.id).eq("is_manager", false),
    supabase.from("fee_invoice").select("owner_entity_id").eq("company_id", company.id).eq("period_start", `${m.data}-01`).neq("status", "void"),
    supabase.from("fee_invoice").select("number").eq("company_id", company.id).order("number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const billed = new Set((existing ?? []).map((x) => x.owner_entity_id));
  let next = (last?.number ?? 1000) + 1;
  let made = 0;
  for (const o of owners ?? []) {
    if (billed.has(o.id)) continue;
    const f = await ownerMonthFees(supabase, company, o.id, m.data);
    if (!f || !f.lines.length) continue;
    const { error } = await supabase.from("fee_invoice").insert({
      company_id: company.id,
      number: next++,
      owner_entity_id: o.id,
      manager_entity_id: manager.id,
      period_start: f.from,
      period_end: f.to,
      lines: f.lines as never,
      total_cents: feeTotal(f.lines),
      created_by: user.id,
    });
    if (error) return { error: error.message };
    made++;
  }
  revalidatePath("/fee-billing");
  return { message: made ? `${made} draft bill${made === 1 ? "" : "s"} made. Review and approve each one.` : "Nothing new to bill for that month." };
}

async function loadBill(id: string) {
  const ctx = await requireCompany();
  const { data: bill } = await ctx.supabase
    .from("fee_invoice")
    .select("*, owner:entity!fee_invoice_owner_entity_id_fkey(id, name, email), manager:entity!fee_invoice_manager_entity_id_fkey(id, name)")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  return { ...ctx, bill };
}

/** Approve a draft: posts the fees on the owner's books (owed) and the management company's (earned). */
export async function approveFeeBill(id: string): Promise<FeeState> {
  const { supabase, company, membership, user, bill } = await loadBill(id);
  if (!ROLES.includes(membership.role)) return { error: "Only an admin or accountant can approve fee bills." };
  if (!bill || bill.status !== "draft") return { error: "Only a draft can be approved." };
  const lines = bill.lines as FeeLine[];
  const e = approvalEntries(lines);
  const label = `Fee bill #${bill.number}, ${bill.period_start.slice(0, 7)}`;
  const { data: ownerEntry, error: e1 } = await supabase.rpc("post_journal_entry", { p_company: company.id, p_entity: bill.owner_entity_id, p_date: bill.period_end, p_memo: `${label} from ${bill.manager.name}`, p_source: "fee", p_lines: e.owner });
  if (e1) return { error: e1.message };
  const { data: managerEntry, error: e2 } = await supabase.rpc("post_journal_entry", { p_company: company.id, p_entity: bill.manager_entity_id, p_date: bill.period_end, p_memo: `${label} to ${bill.owner.name}`, p_source: "fee", p_lines: e.manager });
  if (e2) {
    await supabase.rpc("reverse_journal_entry", { p_entry: ownerEntry as string, p_date: bill.period_end, p_memo: `Undo: ${label}` });
    return { error: e2.message };
  }
  await supabase.from("fee_invoice").update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString(), owner_entry_id: ownerEntry as string, manager_entry_id: managerEntry as string }).eq("id", bill.id);
  revalidatePath("/fee-billing");
  revalidatePath(`/fee-billing/${bill.id}`);
  return { message: "Approved and posted to both sets of books." };
}

/** Record that the owner paid: cash out of the owner's operating account, into the management company's. */
export async function payFeeBill(id: string, _: FeeState, form: FormData): Promise<FeeState> {
  const { supabase, company, membership, bill } = await loadBill(id);
  if (!ROLES.includes(membership.role)) return { error: "Only an admin or accountant can record payments." };
  const p = z.object({ paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), method: z.enum(["ach", "transfer", "check", "other"]), reference: z.string().trim().max(60).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Choose the date and how it was paid." };
  if (!bill || bill.status !== "approved") return { error: "Only an approved, unpaid bill can be paid." };
  const e = paymentEntries(bill.lines as FeeLine[]);
  const memo = `Paid fee bill #${bill.number}${p.data.reference ? ` (${p.data.reference})` : ""}`;
  const { data: ownerEntry, error: e1 } = await supabase.rpc("post_journal_entry", { p_company: company.id, p_entity: bill.owner_entity_id, p_date: p.data.paid_on, p_memo: `${memo} to ${bill.manager.name}`, p_source: "fee_payment", p_lines: e.owner });
  if (e1) return { error: e1.message };
  const { data: managerEntry, error: e2 } = await supabase.rpc("post_journal_entry", { p_company: company.id, p_entity: bill.manager_entity_id, p_date: p.data.paid_on, p_memo: `${memo} from ${bill.owner.name}`, p_source: "fee_payment", p_lines: e.manager });
  if (e2) {
    await supabase.rpc("reverse_journal_entry", { p_entry: ownerEntry as string, p_date: p.data.paid_on, p_memo: `Undo: ${memo}` });
    return { error: e2.message };
  }
  await supabase
    .from("fee_invoice")
    .update({ status: "paid", paid_on: p.data.paid_on, method: p.data.method, reference: p.data.reference || null, owner_payment_entry_id: ownerEntry as string, manager_payment_entry_id: managerEntry as string })
    .eq("id", bill.id);
  revalidatePath("/fee-billing");
  revalidatePath(`/fee-billing/${bill.id}`);
  return { message: "Payment recorded on both sets of books." };
}

/** Void: a draft is simply voided; an approved bill's entries are reversed. A paid bill can't be voided. */
export async function voidFeeBill(id: string): Promise<FeeState> {
  const { supabase, company, membership, bill } = await loadBill(id);
  if (!ROLES.includes(membership.role)) return { error: "Only an admin or accountant can void fee bills." };
  if (!bill || !["draft", "approved"].includes(bill.status)) return { error: "A paid bill can't be voided." };
  const today = todayIn(company.time_zone);
  for (const entry of [bill.owner_entry_id, bill.manager_entry_id]) {
    if (!entry) continue;
    const { error } = await supabase.rpc("reverse_journal_entry", { p_entry: entry, p_date: today, p_memo: `Voided fee bill #${bill.number}` });
    if (error) return { error: error.message };
  }
  await supabase.from("fee_invoice").update({ status: "void" }).eq("id", bill.id);
  revalidatePath("/fee-billing");
  revalidatePath(`/fee-billing/${bill.id}`);
  return { message: "Voided." };
}

/** E-mail the bill as a PDF to the owner (and its partners). */
export async function emailFeeBill(id: string): Promise<FeeState> {
  const { supabase, company, membership, bill } = await loadBill(id);
  if (!ROLES.includes(membership.role)) return { error: "Only an admin or accountant can send fee bills." };
  if (!bill || bill.status === "void" || bill.status === "draft") return { error: "Approve the bill before sending it." };
  const { data: props } = await supabase.from("property").select("property_owner(contact(email))").eq("entity_id", bill.owner_entity_id);
  const to = [...new Set([bill.owner.email, ...(props ?? []).flatMap((p) => p.property_owner.map((o) => o.contact?.email))].map((e) => e?.split(/[,;]/)[0]?.trim()).filter((e): e is string => Boolean(e)))];
  if (!to.length) return { error: "Add the owner's e-mail (Owners › Owner details) first." };
  const lines = bill.lines as FeeLine[];
  const monthName = new Date(`${bill.period_start}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const pdf = await letterPdf({
    letterhead: [bill.manager.name, company.address ?? "", company.office_phone ?? ""],
    date: bill.period_end,
    title: `Management fee bill #${bill.number}: ${bill.owner.name}, ${monthName}`,
    paragraphs: [...lines.map((l) => `${l.property} · ${FEE_KIND_LABEL[l.kind]}: ${l.detail} = ${money(l.amountCents)}`), `Total: ${money(bill.total_cents)}`, bill.status === "paid" ? `Paid ${bill.paid_on}.` : "Due on receipt, per the management agreement."],
  });
  const content = {
    preheader: `${monthName} management fees: ${money(bill.total_cents)}.`,
    heading: `${monthName} management fees`,
    paragraphs: [`Fee bill #${bill.number} for <strong>${bill.owner.name}</strong> is attached: <strong>${money(bill.total_cents)}</strong>.`],
    fromLine: bill.manager.name,
    footer: [company.name, company.office_phone].filter(Boolean).join(" · "),
  };
  const key = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_FROM_DOMAIN;
  if (!key || !domain) return { error: "E-mail isn't set up." };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${company.name} <no-reply@${domain}>`, to, reply_to: company.office_email ?? undefined, subject: `${monthName} management fees: ${bill.owner.name}`, html: emailHtml(content), text: emailText(content), attachments: [{ filename: `Fee bill ${bill.number}.pdf`, content: Buffer.from(pdf).toString("base64") }] }),
  });
  if (!r.ok) return { error: "The e-mail couldn't be sent." };
  await supabase.from("fee_invoice").update({ sent_at: new Date().toISOString() }).eq("id", bill.id);
  revalidatePath(`/fee-billing/${bill.id}`);
  return { message: `Sent to ${to.join(", ")}.` };
}
