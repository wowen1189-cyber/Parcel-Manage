import "server-only";
import { agreementText } from "@/lib/agreement-import";
import { aiComplete } from "@/lib/ai/provider";
import { EXPENSE_ACCOUNTS } from "@/lib/bills";
import { contactName, todayIn } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bareAddress,
  cleanRead,
  guessAmountCents,
  guessInvoiceNumber,
  INVOICE_SYSTEM,
  invoiceFlags,
  invoicePrompt,
  parseInvoiceRead,
  subdomainFromRecipients,
  vendorByEmail,
} from "./invoice-intake-rules";

// E-mailed vendor invoices: Resend receives mail for bills-<subdomain>@<RESEND_INBOUND_DOMAIN> and calls
// app/api/email/inbound. The PDF is saved with the bill, read by the company's AI (or a simple text search
// without AI), and the bill waits in Bills for a person to check and approve it. Nothing is paid or posted here.

type Received = { id: string; from: string; to: string[]; cc?: string[] | null; subject?: string | null; text?: string | null; html?: string | null };
type Attachment = { id: string; filename: string; size: number; content_type: string; content_disposition?: string; download_url: string };

const MAX_FILE = 15 * 1024 * 1024;
const DAILY_LIMIT = 200;

async function resend<T>(path: string): Promise<T> {
  const r = await fetch(`https://api.resend.com/${path}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
  if (!r.ok) throw new Error(`Resend ${r.status}`);
  return (await r.json()) as T;
}

const htmlToText = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();

export type IntakeResult = { status: "bill" | "skipped" | "failed" | "ignored"; billId?: string; note?: string };

/** Handle one received e-mail (by Resend's id). Safe to call twice: the second call does nothing. */
export async function receiveInvoiceEmail(emailId: string): Promise<IntakeResult> {
  const domain = process.env.RESEND_INBOUND_DOMAIN;
  if (!domain || !process.env.RESEND_API_KEY) return { status: "ignored", note: "Inbound e-mail isn't set up." };
  const email = await resend<Received>(`emails/receiving/${encodeURIComponent(emailId)}`);
  const subdomain = subdomainFromRecipients([...(email.to ?? []), ...(email.cc ?? [])], domain);
  // Mail for other addresses on the domain isn't ours to handle.
  if (!subdomain) return { status: "ignored" };

  const db = createAdminClient();
  const { data: company } = await db.from("company").select("id, time_zone").eq("subdomain", subdomain).maybeSingle();
  if (!company) return { status: "ignored" };
  const from = bareAddress(email.from ?? "");
  const record = async (status: "bill" | "skipped" | "failed", note: string | null, billId: string | null = null) => {
    await db.from("inbound_email").update({ status, note, bill_id: billId }).eq("provider_id", email.id);
    return { status, note: note ?? undefined, billId: billId ?? undefined };
  };
  // Claim the e-mail first, so a repeated webhook can't make a second bill.
  const { error: dup } = await db.from("inbound_email").insert({ company_id: company.id, provider_id: email.id, from_address: from.slice(0, 200), subject: (email.subject ?? "").slice(0, 300), status: "failed", note: "Being read" });
  if (dup) return { status: "ignored", note: "Already handled." };

  try {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db.from("inbound_email").select("id", { count: "exact", head: true }).eq("company_id", company.id).gte("created_at", since);
    if ((count ?? 0) > DAILY_LIMIT) return await record("skipped", `More than ${DAILY_LIMIT} e-mails in a day; this one wasn't read.`);

    // Attachments: PDFs are read; photos of invoices are kept with the bill for the person approving it.
    const { data: list } = await resend<{ data: Attachment[] }>(`emails/receiving/${encodeURIComponent(email.id)}/attachments`);
    const files = (list ?? []).filter((a) => a.content_disposition !== "inline" && a.size <= MAX_FILE && /^(application\/pdf|image\/(jpeg|png|heic|webp))$/.test(a.content_type)).slice(0, 3);
    const texts: string[] = [];
    const saved: { path: string; name: string }[] = [];
    for (const [i, a] of files.entries()) {
      const bytes = new Uint8Array(await (await fetch(a.download_url)).arrayBuffer());
      const ext = a.content_type === "application/pdf" ? "pdf" : a.content_type.split("/")[1].replace("jpeg", "jpg");
      const path = `${company.id}/bills/email-${Date.now()}-${i}.${ext}`;
      const { error } = await db.storage.from("documents").upload(path, bytes, { contentType: a.content_type });
      if (!error) saved.push({ path, name: a.filename.slice(0, 120) || `Invoice.${ext}` });
      if (ext === "pdf") texts.push(await agreementText(bytes, "pdf").catch(() => ""));
    }
    const body = (email.text || htmlToText(email.html ?? "")).trim();
    if (!saved.length && !/invoice|amount due|balance due|total/i.test(`${email.subject} ${body}`)) return await record("skipped", "No invoice attached and nothing in the e-mail looked like one.");

    // This company's records the invoice can point at.
    const [{ data: vendorRows }, { data: propertyRows }, { data: woRows }] = await Promise.all([
      db.from("vendor").select("id, contact(kind, first_name, last_name, business_name, email)").eq("company_id", company.id),
      db.from("property").select("id, name, entity_id, address_line1, city").eq("company_id", company.id).order("name"),
      db.from("work_order").select("number, title, property_id, vendor_id").eq("company_id", company.id).order("created_at", { ascending: false }).limit(150),
    ]);
    const vendors = (vendorRows ?? []).map((v) => ({ id: v.id, name: contactName(v.contact), email: v.contact.email }));
    const properties = (propertyRows ?? []).map((p) => ({ id: p.id, name: p.name, address: [p.address_line1, p.city].filter(Boolean).join(", ") }));
    const workOrders = (woRows ?? []).map((w) => ({ number: w.number, title: w.title, propertyId: w.property_id, vendorId: w.vendor_id }));
    const today = todayIn(company.time_zone);
    const allText = [body, ...texts].join("\n");
    const sender = vendorByEmail(from, vendors);

    const ai = await aiComplete({
      companyId: company.id,
      feature: "invoice reading",
      system: INVOICE_SYSTEM,
      prompt: invoicePrompt({ from: email.from, subject: email.subject ?? "", body, attachments: texts, vendors, properties, workOrders, accounts: EXPENSE_ACCOUNTS, today }),
      maxTokens: 700,
      timeoutMs: 45_000,
    });
    const read = ai.ok ? parseInvoiceRead(ai.text) : null;
    const c = read
      ? cleanRead(read, { vendors, properties, workOrders, accounts: EXPENSE_ACCOUNTS.map(([n]) => n) })
      : { vendorId: null, propertyId: null, workOrder: null, invoiceNumber: guessInvoiceNumber(allText), invoiceDate: null, dueDate: null, amountCents: guessAmountCents(allText), expenseAccount: "5000", memo: (email.subject ?? "").slice(0, 300) || null, notes: [] as string[] };
    const vendorId = c.vendorId ?? sender?.id ?? null;
    const propertyId = c.propertyId;
    const property = propertyRows?.find((p) => p.id === propertyId) ?? null;

    const [{ data: dupBill }, { data: history }] = await Promise.all([
      vendorId && c.invoiceNumber ? db.from("bill").select("invoice_number").eq("company_id", company.id).eq("vendor_id", vendorId).eq("invoice_number", c.invoiceNumber).neq("status", "void").limit(1).maybeSingle() : Promise.resolve({ data: null }),
      vendorId ? db.from("bill").select("amount_cents").eq("company_id", company.id).eq("vendor_id", vendorId).neq("status", "void").gt("amount_cents", 0).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] as { amount_cents: number }[] }),
    ]);
    const average = history?.length ? Math.round(history.reduce((s, b) => s + b.amount_cents, 0) / history.length) : null;
    const notes = [
      ...invoiceFlags({ senderKnown: !!sender, vendorFound: !!vendorId, propertyFound: !!propertyId, amountCents: c.amountCents, duplicateOf: dupBill?.invoice_number ?? null, vendorAverageCents: average, noAttachment: !saved.length, aiUsed: !!read }),
      ...c.notes.map((n) => `AI: ${n}`),
    ];

    const { data: bill, error } = await db
      .from("bill")
      .insert({
        company_id: company.id,
        entity_id: property?.entity_id ?? null,
        vendor_id: vendorId,
        property_id: propertyId,
        work_order_id: null,
        invoice_number: c.invoiceNumber,
        invoice_date: c.invoiceDate ?? today,
        due_date: c.dueDate,
        amount_cents: c.amountCents ?? 0,
        expense_account: c.expenseAccount,
        memo: c.memo ?? (c.workOrder ? `Work order #${c.workOrder.number}: ${c.workOrder.title}` : null),
        source: "email",
        from_email: from.slice(0, 200),
        review_notes: notes,
      })
      .select("id")
      .single();
    if (error || !bill) return await record("failed", "The bill couldn't be saved.");
    if (c.workOrder) {
      const { data: wo } = await db.from("work_order").select("id").eq("company_id", company.id).eq("number", c.workOrder.number).maybeSingle();
      if (wo) await db.from("bill").update({ work_order_id: wo.id }).eq("id", bill.id);
    }
    for (const [i, f] of saved.entries()) {
      const { data: doc } = await db.from("document").insert({ company_id: company.id, property_id: propertyId, vendor_id: vendorId, bill_id: bill.id, storage_path: f.path, file_name: f.name, category: "invoice", source: "e-mail" }).select("id").single();
      if (i === 0 && doc) await db.from("bill").update({ document_id: doc.id }).eq("id", bill.id);
    }
    return await record("bill", read ? "Read by AI" : ai.ok ? "The AI's answer couldn't be used; read without AI." : `Read without AI (${ai.reason})`, bill.id);
  } catch (e) {
    return await record("failed", e instanceof Error ? e.message.slice(0, 200) : "Couldn't be read.");
  }
}
