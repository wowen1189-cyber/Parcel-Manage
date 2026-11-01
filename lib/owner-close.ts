import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalBalance, type AccountBalance } from "@/lib/books";
import { contactName } from "@/lib/format";
import { describeFeeParts, effectiveFee, leasingFee, monthlyFee, readCompanyFee } from "@/lib/management-fees";
import { distributable, monthEnd, monthStart, payeesFor, type StatementProperty, type StatementTotals } from "@/lib/owner-statements";
import type { Database } from "@/lib/supabase/database.types";

// Reads one owner's books for a month and works out the statement: rent collected per property, the fees
// it earns, cash, unpaid bills, reserve and what's distributable. Nothing is posted here.

type Db = SupabaseClient<Database>;

export async function previewStatement(supabase: Db, company: { id: string; settings: unknown }, entityId: string, month: string) {
  const from = monthStart(month);
  const to = monthEnd(month);
  const dayBefore = new Date(new Date(`${from}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  const [{ data: owner }, { data: lines }, { data: reversals }, before, period, asOf, { data: bills }] = await Promise.all([
    supabase
      .from("entity")
      .select("id, name, email, reserve_cents, management_fee, property(id, name, management_fee, unit(status, lease(id, start_date, rent_cents, status)), property_owner(ownership_pct, contact(id, kind, first_name, last_name, business_name)))")
      .eq("id", entityId)
      .eq("company_id", company.id)
      .single(),
    // Rent collected: payments credit receivables (0015_accounting.sql); returned payments are reversed.
    supabase
      .from("journal_line")
      .select("credit_cents, debit_cents, property_id, journal_entry!inner(id, entity_id, entry_date, source, status), gl_account!inner(number)")
      .eq("company_id", company.id)
      .eq("journal_entry.entity_id", entityId)
      .eq("journal_entry.source", "payment")
      .gte("journal_entry.entry_date", from)
      .lte("journal_entry.entry_date", to)
      .eq("gl_account.number", "1000"),
    supabase
      .from("journal_line")
      .select("credit_cents, property_id, journal_entry!inner(entity_id, entry_date, source, reversal_of), gl_account!inner(number)")
      .eq("company_id", company.id)
      .eq("journal_entry.entity_id", entityId)
      .eq("journal_entry.source", "reversal")
      .gte("journal_entry.entry_date", from)
      .lte("journal_entry.entry_date", to)
      .eq("gl_account.number", "1000"),
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entityId, p_from: "1900-01-01", p_to: dayBefore }),
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entityId, p_from: from, p_to: to }),
    supabase.rpc("account_balances", { p_company: company.id, p_entity: entityId, p_from: "1900-01-01", p_to: to }),
    supabase.from("bill").select("amount_cents").eq("company_id", company.id).eq("entity_id", entityId).eq("status", "approved"),
  ]);
  if (!owner) return null;
  // Only reversals of payments count against collections.
  const reversedIds = (reversals ?? []).map((r) => r.journal_entry.reversal_of).filter((x): x is string => Boolean(x));
  const { data: originals } = reversedIds.length ? await supabase.from("journal_entry").select("id, source").in("id", reversedIds) : { data: [] };
  const paymentReversals = new Set((originals ?? []).filter((o) => o.source === "payment").map((o) => o.id));

  const companyFee = readCompanyFee(company.settings);
  const properties: StatementProperty[] = owner.property.map((p) => {
    const collected =
      (lines ?? []).filter((l) => l.property_id === p.id).reduce((s, l) => s + Number(l.debit_cents), 0) -
      (reversals ?? []).filter((r) => r.property_id === p.id && r.journal_entry.reversal_of && paymentReversals.has(r.journal_entry.reversal_of)).reduce((s, r) => s + Number(r.credit_cents), 0);
    const occupied = p.unit.filter((u) => u.status === "occupied" || u.status === "notice").length;
    const { fee } = effectiveFee(p.management_fee, owner.management_fee, companyFee);
    const newLeases = p.unit.flatMap((u) => u.lease).filter((l) => l.start_date >= from && l.start_date <= to && ["active", "notice"].includes(l.status));
    return {
      id: p.id,
      name: p.name,
      collectedCents: Math.max(0, collected),
      occupied,
      feeTerms: describeFeeParts(fee).map((x) => `${x.label} ${x.text}`).join(" · "),
      managementFeeCents: monthlyFee(fee, Math.max(0, collected), occupied),
      leasingFeeCents: newLeases.reduce((s, l) => s + leasingFee(fee, l.rent_cents), 0),
      newLeases: newLeases.length,
    };
  });

  const bal = (rows: unknown, n: string) => {
    const r = ((rows ?? []) as AccountBalance[]).find((a) => a.number === n);
    return r ? normalBalance(r) : 0;
  };
  const sumType = (rows: unknown, type: string) => ((rows ?? []) as AccountBalance[]).filter((a) => a.type === type).reduce((s, a) => s + normalBalance(a), 0);
  const fees = properties.reduce((s, p) => s + p.managementFeeCents + p.leasingFeeCents, 0);
  const endingCash = bal(asOf.data, "1000") - fees;
  const payables = (bills ?? []).reduce((s, b) => s + b.amount_cents, 0);
  const totals: StatementTotals = {
    beginningCashCents: bal(before.data, "1000"),
    incomeCents: sumType(period.data, "income"),
    expensesCents: sumType(period.data, "expense") + fees,
    feesCents: fees,
    endingCashCents: endingCash,
    payablesCents: payables,
    reserveCents: owner.reserve_cents,
    distributableCents: distributable(endingCash, payables, owner.reserve_cents),
    depositsHeldCents: bal(asOf.data, "2100"),
  };
  const payees = payeesFor(
    owner.name,
    owner.property.map((p) => ({ partners: p.property_owner.map((o) => ({ contactId: o.contact!.id, name: contactName(o.contact), pct: Number(o.ownership_pct) })) })),
  );
  return { owner, properties, totals, payees, from, to };
}
