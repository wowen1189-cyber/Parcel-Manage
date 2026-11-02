import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readBusinessRules, type BusinessRules } from "@/lib/business-rules";
import { addMonths, countExpirations, monthOf, recommendTerms, type LeaseEnd, type TermOption } from "@/lib/lease-expirations";
import { mtmChoice, termChoice, type RenewalChoice } from "@/lib/renewal-offers";
import type { Database } from "@/lib/supabase/database.types";

// What a renewal offer for one lease starts from: the lease, the day the renewal starts, and every lease
// length with how it fits the expiration calendar (the same planner as Lease expirations).

type Db = SupabaseClient<Database>;

export async function renewalContext(db: Db, company: { id: string; settings: unknown }, leaseId: string, today: string) {
  const { data: lease } = await db
    .from("lease")
    .select("id, status, start_date, end_date, rent_cents, unit!inner(id, label, property_id, property(name)), lease_tenant(is_primary, role, contact(id, first_name, last_name, business_name, email))")
    .eq("id", leaseId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!lease) return null;
  const rules = readBusinessRules(company.settings);
  const [{ data: units }, { data: leases }] = await Promise.all([
    db.from("unit").select("id, property_id").eq("company_id", company.id),
    db.from("lease").select("id, status, end_date, move_out_on, unit!inner(property_id)").eq("company_id", company.id).in("status", ["active", "notice"]),
  ]);
  const ends: LeaseEnd[] = (leases ?? []).map((l) => ({ leaseId: l.id, propertyId: l.unit.property_id, endDate: l.end_date, status: l.status, moveOutOn: l.move_out_on }));
  // The renewal starts the day after the lease ends; month-to-month (or already ended) starts next month.
  const start = lease.end_date && lease.end_date >= today ? dayAfter(lease.end_date) : `${addMonths(monthOf(today), 1)}-01`;
  const plan: TermOption[] = recommendTerms({
    start,
    propertyId: lease.unit.property_id,
    propertyUnits: (units ?? []).filter((u) => u.property_id === lease.unit.property_id).length || 1,
    portfolioUnits: (units ?? []).length,
    counts: countExpirations(ends, lease.id),
    rules,
  });
  return { lease, rules, start, plan };
}

/** The offer's options, priced on the server from the chosen lengths ("mtm" for month-to-month). */
export function buildChoices(picks: string[], ctx: { lease: { rent_cents: number }; rules: BusinessRules; start: string; plan: TermOption[] }, increasePercent: number): RenewalChoice[] | string {
  const out: RenewalChoice[] = [];
  for (const p of picks) {
    if (!p) continue;
    if (p === "mtm") {
      out.push(mtmChoice({ currentRentCents: ctx.lease.rent_cents, increasePercent, start: ctx.start, rules: ctx.rules }));
      continue;
    }
    const o = ctx.plan.find((x) => x.months === Number(p));
    if (!o) return "Choose lengths from the list.";
    out.push(termChoice({ currentRentCents: ctx.lease.rent_cents, increasePercent, start: ctx.start, months: o.months, endDate: o.endDate, rules: ctx.rules }));
  }
  return out;
}

function dayAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
