import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalBalance, type AccountBalance } from "@/lib/books";
import { feeTotal, type FeeLine } from "@/lib/fee-billing";
import { ownerMonthFees } from "@/lib/fee-billing-data";
import { contactName } from "@/lib/format";
import { describeFeeParts } from "@/lib/management-fees";
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
  const [before, period, asOf, { data: bills }, { data: invoice }, { data: banks }] = await Promise.all([
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entityId, p_from: "1900-01-01", p_to: dayBefore }),
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entityId, p_from: from, p_to: to }),
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entityId, p_from: "1900-01-01", p_to: to }),
    supabase.from("bill").select("amount_cents").eq("company_id", company.id).eq("entity_id", entityId).eq("status", "approved"),
    supabase.from("fee_invoice").select("id, number, status, total_cents, lines").eq("owner_entity_id", entityId).eq("period_start", from).neq("status", "void").maybeSingle(),
    supabase.from("bank_account").select("id, name, last4, gl_number, reconciliation(statement_date, statement_balance_cents)").eq("company_id", company.id).eq("entity_id", entityId),
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
  return { owner, properties, totals, payees, from, to, invoice, feeLines: lines, managed, tieOut };
}
