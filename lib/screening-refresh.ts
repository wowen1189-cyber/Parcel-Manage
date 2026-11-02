import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readBusinessRules } from "@/lib/business-rules";
import { recommend, type ScreeningResult } from "@/lib/screening";
import type { Database } from "@/lib/supabase/database.types";

/** Re-run the suggested decision for an application from its screening reports (staff or a Checkr result). */
export async function refreshRecommendation(db: SupabaseClient<Database>, companyId: string, applicationId: string) {
  const [{ data: company }, { data: a }] = await Promise.all([
    db.from("company").select("settings").eq("id", companyId).single(),
    db
      .from("application")
      .select("id, status, rent_cents, application_member(role, monthly_income_cents, screening_report(credit_score, eviction_years_ago, owes_landlord, utility_or_car_problems, criminal_records))")
      .eq("id", applicationId)
      .eq("company_id", companyId)
      .single(),
  ]);
  if (!a) return;
  const adults = a.application_member.filter((m) => m.role !== "guarantor");
  const reports: ScreeningResult[] = adults
    .map((m) => m.screening_report)
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({ creditScore: r.credit_score, evictionYearsAgo: r.eviction_years_ago === null ? null : Number(r.eviction_years_ago), owesLandlord: r.owes_landlord, utilityOrCarProblems: r.utility_or_car_problems, criminalRecords: r.criminal_records }));
  const income = adults.reduce((s, m) => s + m.monthly_income_cents, 0);
  const rec = recommend(readBusinessRules(company?.settings).screening, a.rent_cents, income, reports);
  await db
    .from("application")
    .update({ recommendation: { ...rec, screened: reports.length, adults: adults.length } as never, status: a.status === "new" ? "screening" : a.status })
    .eq("id", a.id)
    .eq("company_id", companyId);
}
