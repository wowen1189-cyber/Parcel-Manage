import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readBusinessRules } from "@/lib/business-rules";
import { readCommercialTerms } from "@/lib/commercial-terms";
import { buildLedger, CHARGE_TYPES, lateFeeAmount, lateFeePolicy, leaseBillsInMonth, monthLabelLong, recurringForMonth, rentForMonth } from "@/lib/ledger";
import type { Database } from "@/lib/supabase/database.types";

// Automatic billing for one company, run daily: rent and recurring charges post on the due day of each
// month, and late fees post when rent is still unpaid on the late day. Safe to run more than once a day:
// it only posts what's missing. Nothing runs until the company sets a billing start date (the cutover from the
// old software), so the two systems never both bill a tenant.

type Db = SupabaseClient<Database>;

export type BillingSettings = { startsOn: string | null };

export function readBillingSettings(settings: unknown): BillingSettings {
  const b = settings && typeof settings === "object" ? (settings as { billing?: { startsOn?: unknown } }).billing : undefined;
  const s = typeof b?.startsOn === "string" && /^\d{4}-\d{2}-01$/.test(b.startsOn) ? b.startsOn : null;
  return { startsOn: s };
}

export type BillingResult = { rent: number; recurring: number; lateFees: number; skipped?: string; errors: string[] };

export async function runBilling(db: Db, company: { id: string; settings: unknown }, today: string): Promise<BillingResult> {
  const result: BillingResult = { rent: 0, recurring: 0, lateFees: 0, errors: [] };
  const { startsOn } = readBillingSettings(company.settings);
  const month = `${today.slice(0, 7)}-01`;
  if (!startsOn) return { ...result, skipped: "Automatic billing is off (no start date)." };
  if (month < startsOn) return { ...result, skipped: `Automatic billing starts ${startsOn}.` };
  const rules = readBusinessRules(company.settings);
  const day = Number(today.slice(8, 10));
  const dueDate = `${month.slice(0, 8)}${String(rules.rent.dueDay).padStart(2, "0")}`;

  const { data: leases, error } = await db
    .from("lease")
    .select(
      "id, status, start_date, end_date, move_out_on, rent_cents, next_rent_increase_on, next_rent_cents, opening_balance_cents, opening_balance_as_of, commercial_terms, late_fee_grace_days, late_fee_flat_cents, late_fee_pct, late_fee_basis, late_fee_daily_cents, late_fee_daily_max_cents, unit(kind), recurring_charge(id, charge_type, description, amount_cents, starts_on, ends_on), charge(id, charge_type, description, amount_cents, due_date, created_at), payment(id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at)",
    )
    .eq("company_id", company.id)
    .in("status", ["active", "notice"]);
  if (error) return { ...result, errors: [error.message] };

  for (const l of leases ?? []) {
    if (!leaseBillsInMonth(l, month)) continue;
    const posted = (type: string, date: string, description?: string) => l.charge.some((c) => c.charge_type === type && c.due_date === date && (!description || c.description === description));
    const post = async (type: string, description: string, amount: number, date: string) => {
      const { error: e } = await db.rpc("post_charge", { p_lease: l.id, p_type: type, p_description: description, p_amount: amount, p_due: date });
      if (e) result.errors.push(`${description}: ${e.message}`);
      else l.charge.push({ id: "new", charge_type: type, description, amount_cents: amount, due_date: date, created_at: "" });
      return !e;
    };

    // Rent and recurring charges, on or after the due day.
    if (day >= rules.rent.dueDay) {
      const rent = rentForMonth(l, month);
      if (rent > 0 && !posted("rent", dueDate) && (await post("rent", `Rent for ${monthLabelLong(month)}`, rent, dueDate))) result.rent++;
      for (const r of recurringForMonth(l.recurring_charge, month)) {
        const description = `${r.description} for ${monthLabelLong(month)}`;
        if (!posted(r.charge_type, dueDate, description) && (await post(r.charge_type, description, r.amount_cents, dueDate))) result.recurring++;
      }
    }

    // Late fees: once on the late day if anything is still owed, then any daily fee the lease provides.
    const commercial = l.unit.kind === "commercial" && l.commercial_terms ? readCommercialTerms(l.commercial_terms) : null;
    const policy = lateFeePolicy(l, rules, commercial);
    if (!policy || day < policy.postsOnDay) continue;
    const { balanceCents } = buildLedger(l.charge, l.payment, { cents: l.opening_balance_cents, asOf: l.opening_balance_as_of });
    if (balanceCents <= 0) continue;
    const lateThisMonth = l.charge.filter((c) => c.charge_type === "late_fee" && c.due_date.startsWith(month.slice(0, 7)));
    const first = lateThisMonth.find((c) => c.description.startsWith("Late fee"));
    if (!first) {
      const amount = lateFeeAmount(policy, rentForMonth(l, month), balanceCents);
      const date = `${month.slice(0, 8)}${String(policy.postsOnDay).padStart(2, "0")}`;
      if (amount > 0 && (await post("late_fee", `Late fee for ${monthLabelLong(month)}`, amount, date))) result.lateFees++;
    } else if (policy.dailyCents > 0 && day > policy.postsOnDay && !posted("late_fee", today, `Daily ${CHARGE_TYPES.late_fee.toLowerCase()}`)) {
      const daily = lateThisMonth.filter((c) => c.description.startsWith("Daily")).reduce((s, c) => s + c.amount_cents, 0);
      const room = policy.dailyMaxCents == null ? policy.dailyCents : Math.min(policy.dailyCents, policy.dailyMaxCents - daily);
      if (room > 0 && (await post("late_fee", `Daily ${CHARGE_TYPES.late_fee.toLowerCase()}`, room, today))) result.lateFees++;
    }
  }
  return result;
}
