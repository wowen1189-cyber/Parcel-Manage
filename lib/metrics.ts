import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalBalance, type AccountBalance } from "@/lib/books";
import { buildLedger } from "@/lib/ledger";
import { METRICS } from "@/lib/metrics-defs";
import type { Database } from "@/lib/supabase/database.types";

// Computes each metric from live records (docs/04 › Metrics page). Null means there's nothing to measure yet.

type Db = SupabaseClient<Database>;
const ratio = (a: number, b: number) => (b ? a / b : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export async function computeMetrics(db: Db, companyId: string, today: string): Promise<Record<string, number | null>> {
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const [{ data: units }, { data: leases }, { data: wos }, { data: guests }, { data: signed }, { data: owners }] = await Promise.all([
    db.from("unit").select("status, market_rent_cents").eq("company_id", companyId),
    db
      .from("lease")
      .select(
        "id, rent_cents, opening_balance_cents, opening_balance_as_of, unit(market_rent_cents), autopay(active), renters_insurance(expires_on, status), lease_tenant(role, contact(id, sms_opt_in, portal_profile_id, emergency_contact(id))), charge(id, charge_type, description, amount_cents, due_date, created_at), payment(id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at)",
      )
      .eq("company_id", companyId)
      .in("status", ["active", "notice"]),
    db.from("work_order").select("status, priority, created_at, completed_at, tech_arrived_at, self_resolved").eq("company_id", companyId).gte("created_at", `${yearAgo}T00:00:00Z`),
    db.from("guest_card").select("id").eq("company_id", companyId).gte("created_at", `${yearAgo}T00:00:00Z`),
    db.from("application").select("id").eq("company_id", companyId).eq("status", "signed").gte("created_at", `${yearAgo}T00:00:00Z`),
    db.from("entity").select("id").eq("company_id", companyId).eq("is_manager", false),
  ]);
  const { count: openCount } = await db.from("work_order").select("id", { count: "exact", head: true }).eq("company_id", companyId).not("status", "in", "(completed,canceled)");

  const L = leases ?? [];
  const tenants = L.flatMap((l) => l.lease_tenant.filter((t) => t.role === "tenant").map((t) => t.contact)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const scheduled = L.reduce((s, l) => s + l.rent_cents, 0);
  const owed = L.reduce((s, l) => s + Math.max(0, buildLedger(l.charge, l.payment, { cents: l.opening_balance_cents, asOf: l.opening_balance_as_of }).balanceCents), 0);
  const withMarket = L.filter((l) => l.unit.market_rent_cents);
  const market = withMarket.reduce((s, l) => s + (l.unit.market_rent_cents ?? 0), 0);
  const leased = withMarket.reduce((s, l) => s + l.rent_cents, 0);
  const done = (wos ?? []).filter((w) => w.completed_at);
  const emergencies = (wos ?? []).filter((w) => w.priority === "emergency" && w.tech_arrived_at);

  let cash = 0;
  for (const o of owners ?? []) {
    const { data } = await db.rpc("account_balances", { p_company: companyId, p_entity: o.id, p_from: "1900-01-01", p_to: today });
    cash += ((data ?? []) as AccountBalance[]).filter((b) => b.number === "1000").reduce((s, b) => s + normalBalance(b), 0);
  }

  const values: Record<string, number | null> = {
    occupancy: ratio((units ?? []).filter((u) => u.status === "occupied" || u.status === "notice").length, (units ?? []).length),
    lead_to_lease: (guests ?? []).length ? ratio((signed ?? []).length, (guests ?? []).length) : null,
    loss_to_lease: market ? Math.max(0, (market - leased) / market) : null,
    delinquency: ratio(owed, scheduled),
    autopay: ratio(L.filter((l) => l.autopay.some((a) => a.active)).length, L.length),
    days_to_complete: mean(done.map((w) => (Date.parse(w.completed_at!) - Date.parse(w.created_at)) / 86_400_000)),
    emergency_response: mean(emergencies.map((w) => (Date.parse(w.tech_arrived_at!) - Date.parse(w.created_at)) / 3_600_000)),
    open_work_orders: openCount ?? 0,
    self_fixed: (wos ?? []).length ? ratio((wos ?? []).filter((w) => w.self_resolved).length, (wos ?? []).length) : null,
    operating_cash: (owners ?? []).length ? cash : null,
    insurance_on_file: ratio(L.filter((l) => l.renters_insurance.some((p) => p.expires_on && p.expires_on >= today)).length, L.length),
    emergency_contact: ratio(tenants.filter((c) => c.emergency_contact.length > 0).length, tenants.length),
    sms_opt_in: ratio(tenants.filter((c) => c.sms_opt_in).length, tenants.length),
    portal_adoption: ratio(tenants.filter((c) => c.portal_profile_id).length, tenants.length),
  };
  return Object.fromEntries(METRICS.map((m) => [m.key, values[m.key] ?? null]));
}

/** Daily snapshot for trends (metric_snapshot), once per day. */
export async function snapshotMetrics(db: Db, companyId: string, today: string) {
  const values = await computeMetrics(db, companyId, today);
  const rows = Object.entries(values)
    .filter(([, v]) => v !== null)
    .map(([metric_key, value]) => ({ company_id: companyId, metric_key, scope_key: "portfolio", on_date: today, value: value as number }));
  if (rows.length) await db.from("metric_snapshot").upsert(rows, { onConflict: "company_id,metric_key,scope_key,on_date" });
  return rows.length;
}
