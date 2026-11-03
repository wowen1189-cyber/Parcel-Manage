import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalBalance, type AccountBalance } from "@/lib/books";
import { FEE_KIND_LABEL, feeTotal, type FeeLine } from "@/lib/fee-billing";
import { ownerMonthFees } from "@/lib/fee-billing-data";
import { contactName } from "@/lib/format";
import { describeFeeParts } from "@/lib/management-fees";
import { cashFlow, itemize, type DetailLine } from "@/lib/owner-statement-detail";
import { distributable, payeesFor, type StatementProperty, type StatementTotals } from "@/lib/owner-statements";
import type { Database } from "@/lib/supabase/database.types";

// Reads one owner's books for a month and works out the statement: gross income collected per property, the
// month's fee bill (lib/fee-billing.ts), cash, unpaid bills and fees, reserve and what's distributable.
// Nothing is posted here. How the money works depends on the owner (entity.books_mode, docs/02 "Owner money"):
// managed owners get distributions and must tie to a reconciled bank statement; own-books owners keep their
// money in their own bank, so there's nothing to distribute.

type Db = SupabaseClient<Database>;

export async function previewStatement(supabase: Db, company: { id: string; settings: unknown }, entityId: string, month: string) {
  const f = await ownerMonthFees(supabase, company, entityId, month);
  if (!f) return null;
  const { owner, from, to } = f;
  const dayBefore = new Date(new Date(`${from}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  const [before, period, asOf, { data: bills }, { data: invoice }, { data: banks }, { data: booked }] = await Promise.all([
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entityId, p_from: "1900-01-01", p_to: dayBefore }),
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entityId, p_from: from, p_to: to }),
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entityId, p_from: "1900-01-01", p_to: to }),
    supabase.from("bill").select("amount_cents").eq("company_id", company.id).eq("entity_id", entityId).eq("status", "approved"),
    supabase.from("fee_invoice").select("id, number, status, total_cents, lines").eq("owner_entity_id", entityId).eq("period_start", from).neq("status", "void").maybeSingle(),
    supabase.from("bank_account").select("id, name, last4, gl_number, reconciliation(statement_date, statement_balance_cents)").eq("company_id", company.id).eq("entity_id", entityId),
    supabase
      .from("journal_line")
      .select("debit_cents, credit_cents, property_id, memo, unit(label), journal_entry!inner(id, entity_id, entry_date, memo, source, status), gl_account!inner(number, name, type)")
      .eq("company_id", company.id)
      .eq("journal_entry.entity_id", entityId)
      .in("journal_entry.status", ["posted", "reversed"])
      .gte("journal_entry.entry_date", from)
      .lte("journal_entry.entry_date", to)
      .limit(20000),
  ]);

  // The bill decides the fees once it exists; until then, what it would be.
  const lines: FeeLine[] = invoice ? (invoice.lines as FeeLine[]) : f.lines;
  const sum = (pid: string, kinds: string[]) => lines.filter((l) => l.propertyId === pid && kinds.includes(l.kind)).reduce((s, l) => s + l.amountCents, 0);
  const properties: StatementProperty[] = f.properties.map((p) => ({
    id: p.id,
    name: p.name,
    collectedCents: p.grossCents,
    occupied: p.occupied,
    feeTerms: describeFeeParts(p.fee)
      .map((x) => `${x.label} ${x.text}`)
      .join(" · "),
    managementFeeCents: sum(p.id, ["management"]),
    leasingFeeCents: sum(p.id, ["leasing", "renewal"]),
    newLeases: p.newLeaseRents.length + p.renewalRents.length,
  }));

  const bal = (rows: unknown, n: string) => {
    const r = ((rows ?? []) as AccountBalance[]).find((a) => a.number === n);
    return r ? normalBalance(r) : 0;
  };
  const sumType = (rows: unknown, type: string) => ((rows ?? []) as AccountBalance[]).filter((a) => a.type === type).reduce((s, a) => s + normalBalance(a), 0);
  const fees = feeTotal(lines);
  const posted = invoice && invoice.status !== "draft";
  // Real cash: fees leave the bank only when the bill is paid.
  const endingCash = bal(asOf.data, "1000");
  const unpaidFees = posted ? bal(asOf.data, "2050") : fees;
  const payables = (bills ?? []).reduce((s, b) => s + b.amount_cents, 0) + unpaidFees;
  const managed = owner.books_mode === "managed";
  const totals: StatementTotals = {
    beginningCashCents: bal(before.data, "1000"),
    incomeCents: sumType(period.data, "income"),
    expensesCents: sumType(period.data, "expense") + (posted ? 0 : fees),
    feesCents: fees,
    endingCashCents: endingCash,
    payablesCents: payables,
    reserveCents: owner.reserve_cents,
    distributableCents: managed ? distributable(endingCash, payables, owner.reserve_cents) : 0,
    depositsHeldCents: bal(asOf.data, "2100"),
    // Equity reads as a credit balance: draws and distributions (3100) are debits.
    drawsCents: -bal(period.data, "3100"),
    contributionsCents: bal(period.data, "3000"),
  };
  const payees = payeesFor(
    owner.name,
    owner.property.map((p) => ({ partners: p.property_owner.map((o) => ({ contactId: o.contact!.id, name: contactName(o.contact), pct: Number(o.ownership_pct) })) })),
  );

  // Tie-out: every operating account reconciled through the month's last day.
  const operating = (banks ?? []).filter((b) => b.gl_number === "1000");
  const reconciled = operating.map((b) => {
    const last = [...b.reconciliation].sort((a, c) => c.statement_date.localeCompare(a.statement_date))[0];
    return { name: `${b.name} …${b.last4 ?? ""}`, through: last?.statement_date ?? null, ok: Boolean(last && last.statement_date >= to) };
  });
  const tieOut = { accounts: reconciled, ok: operating.length > 0 && reconciled.every((r) => r.ok) };

  // The itemized detail (lib/owner-statement-detail.ts): each income and expense line, and the cash walk.
  const entryIds = [...new Set((booked ?? []).map((l) => l.journal_entry.id))];
  const { data: billRows } = entryIds.length
    ? await supabase.from("bill").select("journal_entry_id, paid_entry_id, vendor(contact(kind, first_name, last_name, business_name))").eq("company_id", company.id).eq("entity_id", entityId).or(`journal_entry_id.in.(${entryIds.join(",")}),paid_entry_id.in.(${entryIds.join(",")})`)
    : { data: [] };
  const vendorOf = new Map<string, string>();
  for (const b of billRows ?? []) {
    const name = b.vendor?.contact ? contactName(b.vendor.contact) : null;
    if (!name) continue;
    if (b.journal_entry_id) vendorOf.set(b.journal_entry_id, name);
    if (b.paid_entry_id) vendorOf.set(b.paid_entry_id, name);
  }
  const detailLines: DetailLine[] = (booked ?? []).map((l) => ({
    entryId: l.journal_entry.id,
    date: l.journal_entry.entry_date,
    source: l.journal_entry.source,
    account: l.gl_account.number,
    accountName: l.gl_account.name,
    type: l.gl_account.type,
    debit: Number(l.debit_cents),
    credit: Number(l.credit_cents),
    propertyId: l.property_id,
    unit: l.unit?.label ?? null,
    memo: l.memo || l.journal_entry.memo,
    payee: vendorOf.get(l.journal_entry.id) ?? null,
  }));
  const unposted = posted ? [] : lines.map((l) => ({ propertyId: l.propertyId, label: `${FEE_KIND_LABEL[l.kind]}, ${l.property}`, amountCents: l.amountCents }));
  const detail = {
    groups: itemize(detailLines, properties, unposted, to),
    cash: cashFlow(detailLines, totals.beginningCashCents, endingCash),
  };
  return { owner, properties, totals, payees, from, to, invoice, feeLines: lines, managed, tieOut, detail };
}
