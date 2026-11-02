// Management agreements (management_agreement): the signed contract between an owner and the managing
// company, filled in from the owner, their properties, their fees in Parcel Manage and the terms below.
// The text is lib/documents/management-agreement.ts; Florida law notes are there. Money is integer cents.

import { z } from "zod";
import type { Condition } from "@/lib/documents/types";
import { describeFeeParts, type ManagementFee } from "@/lib/management-fees";

const cents = z.coerce.number().int().min(0).max(100_000_000_00);

export const agreementTermsSchema = z.object({
  termYears: z.coerce.number().int().min(1).max(5),
  autoRenew: z.boolean(),
  noticeDays: z.coerce.number().int().min(30).max(180),
  approvalLimitCents: cents,
  distributionDay: z.coerce.number().int().min(1).max(28),
  reserveCents: cents,
  disbursementFeeCents: cents,
  w9FeeCents: cents,
  releaseMonths: z.coerce.number().int().min(0).max(24),
  inspectionFrequency: z.enum(["monthly", "quarterly", "twice_yearly", "yearly"]),
  residentialLiabilityCents: cents,
  commercialLiabilityCents: cents,
  ownerLiabilityCents: cents,
  evictionEstimate: z.string().trim().min(1).max(60),
  // Powers the owner grants (rents and deposits are always included).
  leasing: z.boolean(),
  evictions: z.boolean(),
  contractors: z.boolean(),
  disbursements: z.boolean(),
});
export type AgreementTerms = z.infer<typeof agreementTermsSchema>;

/** SIM REI's template terms (its Google Docs agreement), as the starting point for a new agreement. */
export const DEFAULT_AGREEMENT_TERMS: AgreementTerms = {
  termYears: 3,
  autoRenew: true,
  noticeDays: 60,
  approvalLimitCents: 50_000,
  distributionDay: 10,
  reserveCents: 0,
  disbursementFeeCents: 13_000,
  w9FeeCents: 5_000,
  releaseMonths: 6,
  inspectionFrequency: "quarterly",
  residentialLiabilityCents: 100_000_00,
  commercialLiabilityCents: 1_000_000_00,
  ownerLiabilityCents: 1_000_000_00,
  evictionEstimate: "$1,000 to $2,500",
  leasing: true,
  evictions: true,
  contractors: true,
  disbursements: false,
};

export const AGREEMENT_STATUS: Record<string, { label: string; tone: "success" | "warn" | "info" | "neutral" }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Out for signature", tone: "info" },
  signed: { label: "Signed", tone: "success" },
  ended: { label: "Ended", tone: "neutral" },
};

export const INSPECTION_LABEL: Record<AgreementTerms["inspectionFrequency"], string> = {
  monthly: "once a month",
  quarterly: "once a quarter",
  twice_yearly: "twice a year",
  yearly: "once a year",
};

export function readAgreementTerms(stored: unknown): AgreementTerms {
  const parsed = agreementTermsSchema.safeParse({ ...DEFAULT_AGREEMENT_TERMS, ...(stored && typeof stored === "object" ? stored : {}) });
  return parsed.success ? parsed.data : DEFAULT_AGREEMENT_TERMS;
}

/** Reads the terms form (dollar fields, checkboxes). */
export function agreementTermsFromForm(raw: Record<string, FormDataEntryValue>): { terms?: AgreementTerms; error?: string } {
  const money = (k: string) => {
    const v = String(raw[k] ?? "").replace(/[$,\s]/g, "");
    if (!v) return 0;
    return /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : NaN;
  };
  const candidate = {
    termYears: raw.term_years,
    autoRenew: raw.auto_renew === "on",
    noticeDays: raw.notice_days,
    approvalLimitCents: money("approval_limit"),
    distributionDay: raw.distribution_day,
    reserveCents: money("reserve"),
    disbursementFeeCents: money("disbursement_fee"),
    w9FeeCents: money("w9_fee"),
    releaseMonths: raw.release_months,
    inspectionFrequency: raw.inspection_frequency,
    residentialLiabilityCents: money("residential_liability"),
    commercialLiabilityCents: money("commercial_liability"),
    ownerLiabilityCents: money("owner_liability"),
    evictionEstimate: String(raw.eviction_estimate ?? ""),
    leasing: raw.power_leasing === "on",
    evictions: raw.power_evictions === "on",
    contractors: raw.power_contractors === "on",
    disbursements: raw.power_disbursements === "on",
  };
  if (Object.values(candidate).some((v) => typeof v === "number" && Number.isNaN(v))) return { error: "Enter dollar amounts like 500 or 1,000,000." };
  const parsed = agreementTermsSchema.safeParse(candidate);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0].path[0]);
    const label: Record<string, string> = {
      termYears: "The term must be 1 to 5 years.",
      noticeDays: "Notice to end must be 30 to 180 days.",
      distributionDay: "Pick a statement day from the 1st to the 28th.",
      releaseMonths: "The re-leasing guarantee must be 0 to 24 months.",
      evictionEstimate: "Enter the eviction cost estimate, like $1,000 to $2,500.",
    };
    return { error: label[field] ?? "Check the agreement terms." };
  }
  return { terms: parsed.data };
}

/** The company's Florida broker license number (company.settings.brokerLicense). */
export function brokerLicense(settings: unknown): string | null {
  const v = settings && typeof settings === "object" ? (settings as { brokerLicense?: unknown }).brokerLicense : null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** End date: the day before the anniversary `years` out. */
export function agreementEndDate(start: string, years: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const end = new Date(Date.UTC(y + years, m - 1, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

const dollars = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const wholeDollars = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const YEARS = ["zero", "one year", "two years", "three years", "four years", "five years"];

export type AgreementInput = {
  createdOn: string;
  startDate: string;
  endDate: string;
  terms: AgreementTerms;
  owner: { name: string; mailing_address: string | null; email: string | null };
  signer: { name: string | null; title: string | null };
  company: { name: string; legal_name: string | null; address: string | null; office_email: string | null; broker_license?: string | null };
  /** Each property with the fee that applies to it (its own, else the owner's, else the company's). */
  properties: { name: string; address: string; fee: ManagementFee }[];
};

/** Fee text: one line when every property has the same fee, else each property's. */
function feeText(properties: AgreementInput["properties"], i: number): string {
  const parts = properties.map((p) => ({ name: p.name, text: describeFeeParts(p.fee)[i].text }));
  const distinct = [...new Set(parts.map((x) => x.text))];
  if (distinct.length <= 1) return distinct[0] ?? "none";
  return parts.map((x) => `${x.name}: ${x.text}`).join("; ");
}

export function fillAgreement(a: AgreementInput): { values: Record<string, string>; conditions: Set<Condition>; missing: string[] } {
  const t = a.terms;
  const values: Record<string, string> = {
    agreement_date: longDate(a.createdOn),
    owner_name: a.owner.name,
    owner_address: a.owner.mailing_address ?? "",
    owner_email: a.owner.email ?? "",
    owner_signer: [a.signer.name, a.signer.title].filter(Boolean).join(", "),
    agent_name: a.company.legal_name ?? a.company.name,
    agent_license: a.company.broker_license ? `a licensed Florida real estate brokerage (license no. ${a.company.broker_license})` : "a licensed Florida real estate brokerage",
    agent_address: a.company.address ?? "",
    agent_email: a.company.office_email ?? "",
    property_list: a.properties.map((p) => `${p.name}, ${p.address}`).join("; "),
    start_date: longDate(a.startDate),
    end_date: longDate(a.endDate),
    term_years: YEARS[t.termYears] ?? `${t.termYears} years`,
    notice_days: String(t.noticeDays),
    eviction_estimate: t.evictionEstimate,
    inspection_frequency: INSPECTION_LABEL[t.inspectionFrequency],
    residential_liability: wholeDollars(t.residentialLiabilityCents),
    commercial_liability: wholeDollars(t.commercialLiabilityCents),
    owner_liability: wholeDollars(t.ownerLiabilityCents),
    approval_limit: dollars(t.approvalLimitCents),
    distribution_day: ordinal(t.distributionDay),
    reserve_amount: dollars(t.reserveCents),
    management_fee: feeText(a.properties, 0),
    leasing_fee: feeText(a.properties, 1),
    renewal_fee: feeText(a.properties, 2),
    disbursement_fee: t.disbursements ? `${dollars(t.disbursementFeeCents)} per property per month` : "not chosen",
    w9_fee: dollars(t.w9FeeCents),
    release_months: String(t.releaseMonths),
  };
  const conditions = new Set<Condition>();
  if (t.leasing) conditions.add("pma_leasing");
  if (t.evictions) conditions.add("pma_evictions");
  if (t.contractors) conditions.add("pma_contractors");
  if (t.disbursements) conditions.add("pma_disbursements");
  if (t.autoRenew) conditions.add("pma_auto_renew");
  const missing: string[] = [];
  if (!a.properties.length) missing.push("at least one property");
  if (!a.owner.mailing_address) missing.push("the owner's mailing address");
  if (!a.owner.email) missing.push("the owner's e-mail");
  if (!a.signer.name) missing.push("who signs for the owner");
  if (!a.company.address) missing.push("your office address (Settings)");
  if (!a.company.office_email) missing.push("your office e-mail (Settings)");
  return { values, conditions, missing };
}
