"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { emailHtml, emailText } from "@/lib/email/layout";
import { money } from "@/lib/format";
import { sendEmail } from "@/lib/integrations/resend/send";
import { letterPdf } from "@/lib/letter-pdf";
import { previewStatement } from "@/lib/owner-close";
import { detailRows, type StatementDetail } from "@/lib/owner-statement-detail";
import { splitByOwnership } from "@/lib/owner-statements";
import { requireCompany } from "@/lib/session";

export type CloseState = { error?: string; message?: string };
const ROLES = ["admin", "accountant"];

/**
 * Close a month for one owner: save the statement and, for owners whose money the company holds, list each
 * payee's share. Fees aren't posted here: they come from the month's approved fee bill (Accounting › Fee billing).
 * Managed owners must tie to the bank first: every operating account reconciled through the month's last day.
 */
export async function closeMonth(_: CloseState, form: FormData): Promise<CloseState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Only an admin or accountant can close a month." };
  const p = z.object({ entity_id: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/, "Choose the month.") }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: existing } = await supabase.from("owner_statement").select("id").eq("entity_id", p.data.entity_id).eq("period_start", `${p.data.month}-01`).maybeSingle();
  if (existing) return { error: "That month is already closed for this owner." };
  const s = await previewStatement(supabase, company, p.data.entity_id, p.data.month);
  if (!s) return { error: "Owner not found." };
  if (s.totals.feesCents > 0 && (!s.invoice || s.invoice.status === "draft"))
    return { error: `Approve this month's fee bill first (Accounting › Fee billing): ${money(s.totals.feesCents)} in fees.` };
  if (s.managed && !s.tieOut.ok)
    return {
      error: s.tieOut.accounts.length
        ? `Reconcile the operating account through ${s.to} first, so the statement ties to the bank: ${s.tieOut.accounts.filter((a) => !a.ok).map((a) => a.name).join(", ")}.`
        : "Add this owner's operating bank account (Bank accounts) and reconcile it through the month's end first.",
    };

  const { data: statement, error } = await supabase
    .from("owner_statement")
    .insert({ company_id: company.id, entity_id: p.data.entity_id, period_start: s.from, period_end: s.to, totals: { ...s.totals, detail: s.detail } as never, lines: s.properties as never, fee_entry_ids: [], created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const shares = s.managed ? splitByOwnership(s.totals.distributableCents, s.payees).filter((x) => x.amountCents > 0) : [];
  if (shares.length) {
    await supabase.from("owner_distribution").insert(shares.map((x) => ({ company_id: company.id, statement_id: statement.id, entity_id: p.data.entity_id, payee_contact_id: x.contactId, payee_name: x.name, ownership_pct: x.pct, amount_cents: x.amountCents })));
  }
  revalidatePath(`/owners/${p.data.entity_id}`);
  redirect(`/owners/${p.data.entity_id}/statements/${statement.id}?closed=1`);
}

/** Record that a distribution was paid (check or ACH sent outside Parcel Manage for now). */
export async function markDistributionPaid(_: CloseState, form: FormData): Promise<CloseState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Only an admin or accountant can pay distributions." };
  const p = z.object({ id: z.string().uuid(), paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), method: z.enum(["ach", "check", "other"]), reference: z.string().trim().max(60).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Choose the date and how it was paid." };
  const { data: d } = await supabase.from("owner_distribution").select("id, status, entity_id, amount_cents, payee_name, statement_id").eq("id", p.data.id).eq("company_id", company.id).maybeSingle();
  if (!d || d.status === "paid") return { error: "Already paid." };
  const { data: entry, error } = await supabase.rpc("post_journal_entry", {
    p_company: company.id,
    p_entity: d.entity_id,
    p_date: p.data.paid_on,
    p_memo: `Owner distribution to ${d.payee_name}${p.data.reference ? ` (${p.data.reference})` : ""}`,
    p_source: "distribution",
    p_lines: [
      { account: "3100", debit: d.amount_cents },
      { account: "1000", credit: d.amount_cents },
    ],
  });
  if (error) return { error: error.message };
  await supabase.from("owner_distribution").update({ status: "paid", paid_on: p.data.paid_on, method: p.data.method, reference: p.data.reference || null, journal_entry_id: entry }).eq("id", d.id);
  revalidatePath(`/owners/${d.entity_id}/statements/${d.statement_id}`);
  return { message: "Recorded." };
}

/** E-mail the statement PDF to the owner and its partners. */
export async function emailStatement(_: CloseState, form: FormData): Promise<CloseState> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Only an admin or accountant can send statements." };
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Statement not found." };
  const { data: st } = await supabase
    .from("owner_statement")
    .select("id, period_start, period_end, totals, lines, entity(id, name, email, property(property_owner(contact(kind, first_name, last_name, business_name, email)))), owner_distribution(payee_name, amount_cents, status)")
    .eq("id", id.data)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!st) return { error: "Statement not found." };
  const to = [...new Set([st.entity.email, ...st.entity.property.flatMap((p) => p.property_owner.map((o) => o.contact?.email))].map((e) => e?.split(/[,;]/)[0]?.trim()).filter((e): e is string => Boolean(e)))];
  if (!to.length) return { error: "Add the owner's e-mail (Owner details) first." };
  const t = st.totals as Record<string, number>;
  const props = st.lines as { name: string; collectedCents: number; managementFeeCents: number; leasingFeeCents: number }[];
  const month = new Date(`${st.period_start}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const rows = [
    `Beginning cash: ${money(t.beginningCashCents)}`,
    `Income: ${money(t.incomeCents)}`,
    `Expenses (including fees): ${money(t.expensesCents)}`,
    `Management, leasing and renewal fees (billed): ${money(t.feesCents)}`,
    `Ending cash: ${money(t.endingCashCents)}`,
    `Unpaid bills and fees: ${money(t.payablesCents)}`,
    `Cash reserve: ${money(t.reserveCents)}`,
    `Distribution: ${money(t.distributableCents)}`,
    `Security deposits held in trust: ${money(t.depositsHeldCents)}`,
    "",
    ...(t.drawsCents || t.contributionsCents ? [`Owner draws: ${money(t.drawsCents ?? 0)}`, `Owner contributions: ${money(t.contributionsCents ?? 0)}`] : []),
    "",
    ...props.map((p) => `${p.name}: gross income collected ${money(p.collectedCents)}, fees ${money(p.managementFeeCents + p.leasingFeeCents)}`),
    "",
    ...st.owner_distribution.map((d) => `${d.payee_name}: ${money(d.amount_cents)} (${d.status})`),
    "",
    ...(t.detail ? detailRows(t.detail as unknown as StatementDetail, money) : []),
  ];
  const pdf = await letterPdf({ letterhead: [company.legal_name ?? company.name, company.address ?? "", company.office_phone ?? ""], date: st.period_end, title: `Owner statement: ${st.entity.name}, ${month}`, paragraphs: rows.filter((r) => r !== "") });
  const content = {
    preheader: `${month} statement for ${st.entity.name}.`,
    heading: `${month} owner statement`,
    paragraphs: [`Your ${month} statement for <strong>${st.entity.name}</strong> is attached.`, `Distribution: <strong>${money(t.distributableCents)}</strong>. Ending cash ${money(t.endingCashCents)}, reserve ${money(t.reserveCents)}.`],
    fromLine: company.name,
    footer: [company.name, company.office_phone].filter(Boolean).join(" · "),
  };
  const key = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_FROM_DOMAIN;
  let ok = false;
  if (key && domain) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${company.name} <no-reply@${domain}>`, to, reply_to: company.office_email ?? undefined, subject: `${month} owner statement: ${st.entity.name}`, html: emailHtml(content), text: emailText(content), attachments: [{ filename: `Statement ${st.entity.name} ${st.period_start.slice(0, 7)}.pdf`, content: Buffer.from(pdf).toString("base64") }] }),
    });
    ok = r.ok;
  } else ok = await sendEmail({ to, subject: `${month} owner statement`, html: emailHtml(content), text: emailText(content), fromName: company.name });
  if (!ok) return { error: "The e-mail couldn't be sent." };
  await supabase.from("owner_statement").update({ sent_at: new Date().toISOString() }).eq("id", st.id);
  revalidatePath(`/owners/${st.entity.id}/statements/${st.id}`);
  return { message: `Sent to ${to.join(", ")}.` };
}

export async function saveReserve(_: CloseState, form: FormData): Promise<CloseState> {
  const { supabase, company, membership } = await requireCompany();
  if (!["admin", "accountant", "property_manager"].includes(membership.role)) return { error: "Your role can't change the reserve." };
  const id = z.string().uuid().safeParse(form.get("entity_id"));
  const v = String(form.get("reserve") ?? "").replace(/[$,\s]/g, "");
  if (!id.success || !/^\d+(\.\d{1,2})?$/.test(v || "0")) return { error: "Enter the reserve in dollars." };
  await supabase.from("entity").update({ reserve_cents: Math.round(Number(v || 0) * 100) }).eq("id", id.data).eq("company_id", company.id);
  revalidatePath(`/owners/${id.data}`);
  return { message: "Saved." };
}

