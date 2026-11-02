import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckrError, createOrder, getOrder, getOrderReport } from "@/lib/integrations/checkr/client";
import { orderBody, reportToScreening, type CheckrPackage } from "@/lib/integrations/checkr/rules";
import { todayIn } from "@/lib/format";
import { refreshRecommendation } from "@/lib/screening-refresh";
import type { Database } from "@/lib/supabase/database.types";

// Ordering a Checkr screening for one applicant, and bringing the result in. The idempotency key is saved
// before the order is placed and reused only to retry that same order. When the report is ready, the facts
// the criteria use go into screening_report (with Checkr named as the agency for any FCRA adverse action
// notice) and the suggested decision is recalculated; a person still decides.

type Db = SupabaseClient<Database>;
const AGENCY = "Checkr, Inc.";

export async function placeCheckrOrder(db: Db, company: { id: string; name: string; legal_name?: string | null; office_email?: string | null }, memberId: string, pkg: CheckrPackage, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: m } = await db
    .from("application_member")
    .select("id, first_name, last_name, email, application(id, unit(label, property(name, address_line1, address_line2, city, state, postal_code)))")
    .eq("id", memberId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!m) return { ok: false, error: "Applicant not found." };
  if (!m.email) return { ok: false, error: "This applicant has no e-mail address. Checkr e-mails them to complete the screening." };
  const p = m.application.unit?.property;
  if (!p?.address_line1 || !p.city || !p.state || !p.postal_code) return { ok: false, error: "The property's street address, city, state and ZIP are needed. Add them on the property." };
  const { data: open } = await db.from("screening_order").select("id").eq("company_id", company.id).eq("application_member_id", m.id).in("status", ["placing", "waiting_for_applicant", "pending"]).limit(1).maybeSingle();
  if (open) return { ok: false, error: "A screening is already in progress for this applicant." };

  const key = randomUUID();
  const { data: row, error } = await db.from("screening_order").insert({ company_id: company.id, application_member_id: m.id, package: pkg, idempotency_key: key, created_by: userId }).select("id").single();
  if (error || !row) return { ok: false, error: "The order couldn't be saved." };
  const body = orderBody({
    pkg,
    applicant: { first_name: m.first_name, last_name: m.last_name, email: m.email.split(/[,;]/)[0].trim() },
    property: { name: p.name, street: p.address_line1, unit: m.application.unit?.label && m.application.unit.label !== "Home" ? m.application.unit.label : p.address_line2, city: p.city, state: p.state, zipcode: p.postal_code },
    company: { id: company.id, name: company.legal_name || company.name, email: company.office_email },
  });
  try {
    const o = await createOrder(body, key);
    await db.from("screening_order").update({ order_id: o.id, status: o.status, live_mode: o.live_mode, application_url: o.application_url }).eq("id", row.id);
    await db.from("application").update({ status: "screening" }).eq("id", m.application.id).eq("company_id", company.id).eq("status", "new");
    return { ok: true };
  } catch (e) {
    const err = e instanceof CheckrError ? e : new CheckrError(0, "unknown", "Checkr didn't respond.");
    const field = err.field ? ` (${err.field.replace(/^\//, "").replace(/\//g, " ")})` : "";
    const message = err.status === 401 ? "The Checkr key is wrong or was revoked." : err.status === 403 ? "Checkr access isn't on yet." : err.status === 402 ? "Checkr needs a payment method on the account." : `${err.message}${field}`;
    await db.from("screening_order").update({ status: "failed", error: message.slice(0, 300) }).eq("id", row.id);
    console.error("checkr order failed", row.id, err.status, err.code);
    return { ok: false, error: message };
  }
}

/** Bring a Checkr order up to date; when complete, file the result and refresh the suggestion. */
export async function syncCheckrOrder(db: Db, orderRowId: string): Promise<{ status: string }> {
  const { data: row } = await db.from("screening_order").select("id, company_id, order_id, status, application_member_id, application_member(application_id), company(time_zone)").eq("id", orderRowId).maybeSingle();
  if (!row?.order_id) return { status: row?.status ?? "missing" };
  if (row.status === "completed" || row.status === "canceled") return { status: row.status };
  const o = await getOrder(row.order_id);
  if (o.status === "canceled") {
    await db.from("screening_order").update({ status: "canceled" }).eq("id", row.id);
    return { status: "canceled" };
  }
  if (o.status !== "completed") {
    await db.from("screening_order").update({ status: o.status }).eq("id", row.id);
    return { status: o.status };
  }
  const report = await getOrderReport(row.order_id);
  if (!report) return { status: "pending" };
  const { result, notes } = reportToScreening(report, todayIn(row.company?.time_zone ?? "America/New_York"));
  await db.from("screening_report").upsert(
    {
      company_id: row.company_id,
      application_member_id: row.application_member_id,
      provider: "checkr",
      credit_score: result.creditScore,
      eviction_years_ago: result.evictionYearsAgo,
      owes_landlord: result.owesLandlord,
      utility_or_car_problems: result.utilityOrCarProblems,
      criminal_records: result.criminalRecords,
      agency_name: AGENCY,
      report_ref: report.id,
      received_at: new Date().toISOString(),
    },
    { onConflict: "application_member_id" },
  );
  const statuses = Object.fromEntries((["credit_report", "eviction_history", "criminal_history", "sex_offender_registry", "global_watchlist"] as const).filter((k) => report[k]).map((k) => [k, report[k]?.status ?? null]));
  await db.from("screening_order").update({ status: "completed", report_id: report.id, product_statuses: statuses, notes, completed_at: new Date().toISOString() }).eq("id", row.id);
  if (row.application_member?.application_id) await refreshRecommendation(db, row.company_id, row.application_member.application_id);
  return { status: "completed" };
}
