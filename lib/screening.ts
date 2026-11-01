import type { BusinessRules } from "@/lib/business-rules";

// Screening decisions from the company's written rental criteria (docs/02-business-rules.md), applied the
// same way to every applicant (Fair Housing Act). The result is a recommendation: a person makes the final
// decision (CLAUDE.md rule 4). Declines and higher-deposit approvals based on a consumer report need an
// adverse action notice (FCRA, 15 U.S.C. 1681m(a)).

export type ScreeningResult = {
  creditScore: number | null; // null = no score (thin file); no minimum score is required
  evictionYearsAgo: number | null; // most recent eviction, in years; null = none found
  owesLandlord: boolean;
  utilityOrCarProblems: boolean;
  criminalRecords: boolean;
};

export type Decision = "approve" | "approve_higher_deposit" | "review" | "decline";

export type Recommendation = {
  decision: Decision;
  reasons: string[];
  depositMonths: { min: number; max: number };
  adverseAction: boolean; // a consumer report contributed to a decline or worse terms
  incomeRatio: number;
};

export const DECISION_LABEL: Record<Decision, string> = {
  approve: "Approve",
  approve_higher_deposit: "Approve with higher deposit",
  review: "Review by a person",
  decline: "Decline",
};

/**
 * Household gross monthly income against rent; then the report. Income is a hard minimum, so a higher
 * deposit never makes up for it. With several adults, the lowest credit score in the household sets the tier.
 */
export function recommend(rules: BusinessRules["screening"], rentCents: number, householdIncomeCents: number, reports: ScreeningResult[]): Recommendation {
  const ratio = rentCents > 0 ? householdIncomeCents / rentCents : 0;
  const decline: string[] = [];
  const review: string[] = [];
  if (ratio < rules.incomeMultiple) decline.push(`Household income is ${ratio.toFixed(2)}× rent; the minimum is ${rules.incomeMultiple}×.`);
  if (reports.some((r) => r.evictionYearsAgo !== null && r.evictionYearsAgo < rules.evictionLookbackYears)) decline.push(`An eviction in the last ${rules.evictionLookbackYears} years.`);
  if (rules.declineIfOwesLandlord && reports.some((r) => r.owesLandlord)) decline.push("Money owed to a past landlord.");
  if (rules.reviewUtilityOrCarPaymentProblems && reports.some((r) => r.utilityOrCarProblems)) review.push("Late or unpaid utility or car payments.");
  if (reports.some((r) => r.criminalRecords)) review.push("Something on the criminal report: a person reviews it case by case (no automatic denials).");
  const scores = reports.map((r) => r.creditScore).filter((s): s is number => s !== null);
  const low = scores.length ? Math.min(...scores) : null;
  const belowTier = low === null || low < rules.creditTierScore;
  const tier = belowTier ? { min: rules.depositMonthsBelowTierMin, max: rules.depositMonthsBelowTierMax } : { min: rules.depositMonthsAtOrAboveTier, max: rules.depositMonthsAtOrAboveTier };
  const reportBased = decline.some((r) => !r.startsWith("Household income"));

  if (decline.length) return { decision: "decline", reasons: [...decline, ...review], depositMonths: tier, adverseAction: reportBased, incomeRatio: ratio };
  if (review.length) return { decision: "review", reasons: review, depositMonths: tier, adverseAction: false, incomeRatio: ratio };
  if (belowTier)
    return {
      decision: "approve_higher_deposit",
      reasons: [low === null ? "No credit score on file." : `Credit score ${low} is under ${rules.creditTierScore}.`],
      depositMonths: tier,
      adverseAction: true,
      incomeRatio: ratio,
    };
  return { decision: "approve", reasons: ["Meets every rental criterion."], depositMonths: tier, adverseAction: false, incomeRatio: ratio };
}

/** Deposit for a number of months' rent, rounded to whole dollars. */
export function depositFor(rentCents: number, months: number): number {
  return Math.round((rentCents * months) / 100) * 100;
}

/** Fees due at submission: the application fee for each adult plus one admin fee. */
export function applicationFees(fees: BusinessRules["fees"], adults: number) {
  const application = fees.applicationFeePerAdultCents * Math.max(1, adults);
  return { applicationCents: application, adminCents: fees.adminFeeCents, totalCents: application + fees.adminFeeCents };
}
