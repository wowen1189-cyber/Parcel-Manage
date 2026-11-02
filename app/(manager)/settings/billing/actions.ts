"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runBilling } from "@/lib/billing-run";
import { todayIn } from "@/lib/format";
import { isAdmin, requireCompany } from "@/lib/session";
import { CUTOVER_CREDIT_REF, CUTOVER_CREDIT_REFS, CUTOVER_DEPOSIT_REF, previousSoftware } from "@/lib/switch-over";

export type BillingState = { error?: string; message?: string };
const ADMIN_ONLY = "Only an admin can change billing.";

/** Turn automatic billing on from a month (the cutover from the old software), or off. */
export async function saveBillingStart(_: BillingState, form: FormData): Promise<BillingState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };
  const raw = String(form.get("starts_month") ?? "");
  const off = form.get("off") === "1";
  if (!off && !/^\d{4}-\d{2}$/.test(raw)) return { error: "Choose the first month Parcel Manage should bill." };
  const settings = company.settings && typeof company.settings === "object" && !Array.isArray(company.settings) ? company.settings : {};
  const { error } = await supabase.from("company").update({ settings: { ...settings, billing: { startsOn: off ? null : `${raw}-01` } } }).eq("id", company.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/billing");
  return { message: off ? "Automatic billing is off." : `Automatic billing starts ${raw}. Rent posts on the due day each month.` };
}

/** Run today's billing now (the daily job does this automatically). */
export async function runBillingNow(): Promise<BillingState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };
  const r = await runBilling(supabase, company, todayIn(company.time_zone));
  revalidatePath("/tenants");
  if (r.skipped) return { error: r.skipped };
  const msg = `Posted ${r.rent} rent, ${r.recurring} other monthly and ${r.lateFees} late fee charge${r.rent + r.recurring + r.lateFees === 1 ? "" : "s"}.`;
  return r.errors.length ? { error: `${msg} ${r.errors.length} failed: ${r.errors.slice(0, 3).join("; ")}` } : { message: msg };
}

/**
 * Cutover: bring the old software's tenant balances (and, optionally, security deposits held) onto the books as of
 * the cutover date, so ledgers continue from where it left off. Each lease only once.
 */
export async function postOpeningBalances(_: BillingState, form: FormData): Promise<BillingState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };
  const parsed = z.object({ as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the cutover date."), deposits: z.literal("on").optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const asOf = parsed.data.as_of;
  const from = previousSoftware(company.settings) ?? "previous software";
  const { data: leases, error } = await supabase
    .from("lease")
    .select("id, deposit_cents, opening_balance_cents, unit(id, property(id, entity_id)), charge(charge_type), payment(purpose, reference)")
    .eq("company_id", company.id)
    .in("status", ["active", "notice"]);
  if (error) return { error: error.message };
  let balances = 0;
  let credits = 0;
  let deposits = 0;
  const failed: string[] = [];
  for (const l of leases ?? []) {
    const bal = l.opening_balance_cents ?? 0;
    const already = l.charge.some((c) => c.charge_type === "opening_balance") || l.payment.some((p) => CUTOVER_CREDIT_REFS.includes(p.reference ?? ""));
    if (bal > 0 && !already) {
      const { error: e } = await supabase.rpc("post_charge", { p_lease: l.id, p_type: "opening_balance", p_description: `Balance from ${from}`, p_amount: bal, p_due: asOf });
      if (e) failed.push(e.message);
      else balances++;
    } else if (bal < 0 && !already) {
      // A prepaid credit: reduce the receivable against opening equity, shown on the ledger as a payment.
      const { data: entry, error: e } = await supabase.rpc("post_journal_entry", {
        p_company: company.id,
        p_entity: l.unit.property.entity_id,
        p_date: asOf,
        p_memo: `Credit from ${from}`,
        p_source: "opening",
        p_lines: [
          { account: "3900", debit: -bal, property_id: l.unit.property.id, unit_id: l.unit.id },
          { account: "1100", credit: -bal, property_id: l.unit.property.id, unit_id: l.unit.id },
        ],
      });
      if (e) failed.push(e.message);
      else {
        await supabase.from("payment").insert({ company_id: company.id, lease_id: l.id, method: "other", amount_cents: -bal, received_on: asOf, status: "succeeded", purpose: "rent", reference: CUTOVER_CREDIT_REF, journal_entry_id: entry });
        credits++;
      }
    }
    if (parsed.data.deposits && l.deposit_cents > 0 && !l.payment.some((p) => p.purpose === "deposit")) {
      const { error: e } = await supabase.rpc("record_payment", { p_lease: l.id, p_method: "other", p_amount: l.deposit_cents, p_received: asOf, p_purpose: "deposit", p_reference: CUTOVER_DEPOSIT_REF });
      if (e) failed.push(e.message);
      else deposits++;
    }
  }
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
  const n = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;
  const msg = `Posted ${n(balances, "balance", "balances")}, ${n(credits, "credit", "credits")}${parsed.data.deposits ? ` and ${n(deposits, "deposit", "deposits")}` : ""} as of ${asOf}.`;
  return failed.length ? { error: `${msg} ${failed.length} failed: ${[...new Set(failed)].slice(0, 3).join("; ")}` } : { message: msg };
}

