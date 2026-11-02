// Commercial lease terms (lease.commercial_terms): the parts of a commercial deal that a residential
// lease doesn't have. Florida ch. 83 Part I (nonresidential) sets almost none of these; they are the
// deal the parties sign. The values the statute does fix live in the lease text (3-day notice for
// unpaid rent, 83.20(2); double rent for holding over, 83.06(1)). Money is integer cents.

import { z } from "zod";

const cents = z.coerce.number().int().min(0).max(10_000_000_00);

export const commercialTermsSchema = z.object({
  // The tenant business, printed as "Person, dba Business".
  businessName: z.string().trim().max(150),
  permittedUse: z.string().trim().max(300),
  annualIncreasePercent: z.coerce.number().min(0).max(25),
  renewalOptions: z.coerce.number().int().min(0).max(5),
  renewalTermMonths: z.coerce.number().int().min(1).max(120),
  renewalNoticeDays: z.coerce.number().int().min(0).max(365),
  // Base Rent for a renewal term: the last rent of the prior term, increased by this percent.
  renewalIncreasePercent: z.coerce.number().min(0).max(25),
  camMonthlyCents: cents,
  camFixed: z.boolean(),
  utilitiesMonthlyCents: cents,
  lateAfterDay: z.coerce.number().int().min(2).max(28),
  lateFeePercent: z.coerce.number().min(0).max(25),
  returnedPaymentFeeCents: cents,
  repairThresholdCents: cents,
  warrantyDays: z.coerce.number().int().min(0).max(365),
  landlordWork: z.string().trim().max(4000),
  tenantWork: z.string().trim().max(4000),
});
export type CommercialTerms = z.infer<typeof commercialTermsSchema>;

/** Starting terms for a new commercial lease (SIM REI's current commercial lease). Each lease can change them. */
export const DEFAULT_COMMERCIAL_TERMS: CommercialTerms = {
  businessName: "",
  permittedUse: "",
  annualIncreasePercent: 5,
  renewalOptions: 1,
  renewalTermMonths: 12,
  renewalNoticeDays: 90,
  renewalIncreasePercent: 5,
  camMonthlyCents: 0,
  camFixed: true,
  utilitiesMonthlyCents: 0,
  lateAfterDay: 6,
  lateFeePercent: 10,
  returnedPaymentFeeCents: 5000,
  repairThresholdCents: 75000,
  warrantyDays: 90,
  landlordWork: "None.",
  tenantWork: "None.",
};

/** Commercial leases run longer than residential ones; Florida sets no maximum. */
export const COMMERCIAL_TERM_MONTHS = { min: 1, max: 120, default: 36 };

// The choices SIM REI offers (a company setting later): 3- to 5-year terms with 0%, 3% or 5% yearly
// increases, renewed for 1 or 2 years at an increased rent. A lease saved with another value keeps it.
export const COMMERCIAL_TERM_CHOICES = [36, 48, 60];
export const ESCALATION_CHOICES = [0, 3, 5];
export const RENEWAL_TERM_CHOICES = [12, 24];
export const RENEWAL_INCREASE_CHOICES = [3, 5];

/** The choices, plus the current value when a lease already has a different one. */
export function withCurrent(choices: number[], current: number): number[] {
  return choices.includes(current) ? choices : [...choices, current].sort((a, b) => a - b);
}

export function readCommercialTerms(stored: unknown): CommercialTerms {
  const parsed = commercialTermsSchema.safeParse({ ...DEFAULT_COMMERCIAL_TERMS, ...(stored && typeof stored === "object" ? stored : {}) });
  return parsed.success ? parsed.data : DEFAULT_COMMERCIAL_TERMS;
}

/** Commercial terms still missing before the lease can be printed. */
export function missingCommercialTerms(t: CommercialTerms): string[] {
  const missing: string[] = [];
  if (!t.permittedUse) missing.push("permitted use");
  return missing;
}

function addYears(iso: string, years: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dayBefore(iso: string) {
  const t = new Date(`${iso}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export type RentStep = { from: string; to: string; monthlyCents: number };

/**
 * Base rent for each lease year: the starting rent, increased by the yearly percent on each anniversary
 * (each year's rent rounded to the cent, then increased again, as SIM REI's lease shows it:
 * $1,000.00, $1,050.00, $1,102.50).
 */
export function rentSchedule(start: string, end: string, baseRentCents: number, increasePercent: number): RentStep[] {
  const steps: RentStep[] = [];
  let rent = baseRentCents;
  for (let year = 0; year < 50; year++) {
    const from = addYears(start, year);
    if (from > end) break;
    const next = addYears(start, year + 1);
    steps.push({ from, to: next > end ? end : dayBefore(next), monthlyCents: rent });
    rent = Math.round((rent * (100 + increasePercent)) / 100);
  }
  return steps;
}

/** Reads the commercial terms form (dollar and percent text fields). */
export function commercialTermsFromForm(raw: Record<string, FormDataEntryValue>, base: CommercialTerms = DEFAULT_COMMERCIAL_TERMS): { terms?: CommercialTerms; error?: string } {
  const money = (k: string, d: number) => {
    if (!(k in raw)) return d;
    const v = String(raw[k]).replace(/[$,\s]/g, "");
    if (!v) return 0;
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return NaN;
    return Math.round(Number(v) * 100);
  };
  const num = (k: string, d: number) => (k in raw ? Number(String(raw[k]).replace(/[%\s]/g, "") || 0) : d);
  const text = (k: string, d: string) => (k in raw ? String(raw[k]) : d);
  const candidate = {
    businessName: text("business_name", base.businessName),
    permittedUse: text("permitted_use", base.permittedUse),
    annualIncreasePercent: num("annual_increase", base.annualIncreasePercent),
    renewalOptions: num("renewal_options", base.renewalOptions),
    renewalTermMonths: num("renewal_term_months", base.renewalTermMonths),
    renewalNoticeDays: num("renewal_notice_days", base.renewalNoticeDays),
    renewalIncreasePercent: num("renewal_increase", base.renewalIncreasePercent),
    camMonthlyCents: money("cam_monthly", base.camMonthlyCents),
    camFixed: "cam_fixed" in raw || "cam_monthly" in raw ? raw.cam_fixed === "on" : base.camFixed,
    utilitiesMonthlyCents: money("utilities_monthly", base.utilitiesMonthlyCents),
    lateAfterDay: num("late_after_day", base.lateAfterDay),
    lateFeePercent: num("late_fee_percent", base.lateFeePercent),
    returnedPaymentFeeCents: money("returned_payment_fee", base.returnedPaymentFeeCents),
    repairThresholdCents: money("repair_threshold", base.repairThresholdCents),
    warrantyDays: num("warranty_days", base.warrantyDays),
    landlordWork: text("landlord_work", base.landlordWork) || "None.",
    tenantWork: text("tenant_work", base.tenantWork) || "None.",
  };
  if (Object.values(candidate).some((v) => typeof v === "number" && Number.isNaN(v))) return { error: "Enter amounts as dollars and percents as numbers, like 1050 or 5." };
  const parsed = commercialTermsSchema.safeParse(candidate);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0].path[0]);
    const label: Record<string, string> = {
      annualIncreasePercent: "The yearly increase must be between 0% and 25%.",
      lateAfterDay: "Rent can be late after a day between the 2nd and the 28th.",
      lateFeePercent: "The late charge must be between 0% and 25%.",
      renewalOptions: "Renewal terms must be between 0 and 5.",
      renewalTermMonths: "Each renewal term must be 1 to 120 months.",
      renewalNoticeDays: "Renewal notice must be 0 to 365 days.",
      renewalIncreasePercent: "The renewal increase must be between 0% and 25%.",
      warrantyDays: "The warranty period must be 0 to 365 days.",
    };
    return { error: label[field] ?? "Check the commercial terms." };
  }
  return { terms: parsed.data };
}
