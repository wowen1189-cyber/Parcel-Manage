import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { feeLines, grossCollected, type BookEntry, type FeeLine, type FeeProperty } from "@/lib/fee-billing";
import { effectiveFee, readCompanyFee } from "@/lib/management-fees";
import { monthEnd, monthStart } from "@/lib/owner-statements";
import type { Database } from "@/lib/supabase/database.types";

// Reads one owner's books for a month: gross income collected per property, new leases and applied renewals,
// and the fee lines they earn (lib/fee-billing.ts). Nothing is posted here.

type Db = SupabaseClient<Database>;

export async function ownerMonthFees(db: Db, company: { id: string; settings: unknown }, entityId: string, month: string) {
  const from = monthStart(month);
  const to = monthEnd(month);
  const [{ data: owner }, { data: lines }, { data: renewals }] = await Promise.all([
    db
      .from("entity")
      .select("id, name, email, books_mode, reserve_cents, management_fee, property(id, name, management_fee, unit(status, lease(id, start_date, rent_cents, status)), property_owner(ownership_pct, contact(id, kind, first_name, last_name, business_name)))")
      .eq("id", entityId)
      .eq("company_id", company.id)
      .single(),
    db
      .from("journal_line")
      .select("debit_cents, credit_cents, property_id, journal_entry!inner(id, entity_id, entry_date, source, status, reversal_of), gl_account!inner(number, type)")
      .eq("company_id", company.id)
      .eq("journal_entry.entity_id", entityId)
      .gte("journal_entry.entry_date", from)
      .lte("journal_entry.entry_date", to)
      .limit(10000),
    db
      .from("renewal_offer")
      .select("options, chosen_option, applied_at, lease!inner(unit!inner(property_id, property!inner(entity_id)))")
      .eq("company_id", company.id)
      .eq("status", "applied")
      .eq("lease.unit.property.entity_id", entityId)
      .gte("applied_at", `${from}T00:00:00Z`)
      .lte("applied_at", `${to}T23:59:59Z`),
  ]);
  if (!owner) return null;

  const entries = new Map<string, BookEntry>();
  for (const l of lines ?? []) {
    const e = entries.get(l.journal_entry.id) ?? { id: l.journal_entry.id, source: l.journal_entry.source, reversal_of: l.journal_entry.reversal_of, lines: [] };
    e.lines.push({ account: l.gl_account.number, type: l.gl_account.type, debit: Number(l.debit_cents), credit: Number(l.credit_cents), property_id: l.property_id });
    entries.set(e.id, e);
  }
  const reversed = [...entries.values()].map((e) => e.reversal_of).filter((x): x is string => Boolean(x));
  const { data: originals } = reversed.length ? await db.from("journal_entry").select("id, source").in("id", reversed) : { data: [] };
  const gross = grossCollected([...entries.values()], new Map((originals ?? []).map((o) => [o.id, o.source])));

  const companyFee = readCompanyFee(company.settings);
  const properties: (FeeProperty & { feeSource: string })[] = owner.property.map((p) => {
    const { fee, source } = effectiveFee(p.management_fee, owner.management_fee, companyFee);
    return {
      id: p.id,
      name: p.name,
      fee,
      feeSource: source,
      grossCents: gross.get(p.id) ?? 0,
      occupied: p.unit.filter((u) => u.status === "occupied" || u.status === "notice").length,
      newLeaseRents: p.unit
        .flatMap((u) => u.lease)
        .filter((l) => l.start_date >= from && l.start_date <= to && ["active", "notice"].includes(l.status))
        .map((l) => l.rent_cents),
      renewalRents: (renewals ?? [])
        .filter((r) => r.lease.unit.property_id === p.id && r.chosen_option != null)
        .map((r) => (r.options as { kind: string; rentCents: number }[])[r.chosen_option!])
        // Month-to-month isn't a renewal: the tenant pays the month-to-month fee instead.
        .filter((c) => c?.kind === "term")
        .map((c) => c.rentCents),
    };
  });
  const fees: FeeLine[] = feeLines(properties);
  return { owner, properties, lines: fees, from, to };
}

/** The management company's books for this company, if set up. */
export async function managerEntity(db: Db, companyId: string) {
  const { data } = await db.from("entity").select("id, name").eq("company_id", companyId).eq("is_manager", true).maybeSingle();
  return data;
}
