import { businessRulesSchema, DEFAULT_BUSINESS_RULES, type BusinessRules } from "./business-rules";

// How each business rule shows on Settings › Business rules, and how a submitted form turns back into rules.
export type RuleFieldType = "text" | "money" | "number" | "percent" | "months" | "time" | "boolean" | "list";
export type RuleField = { path: string; label: string; type: RuleFieldType; hint?: string };
export type RuleSection = { title: string; description?: string; fields: RuleField[] };

export const RULE_SECTIONS: RuleSection[] = [
  {
    title: "Office and escalation",
    fields: [
      { path: "office.hours", label: "Office hours", type: "text" },
      { path: "escalation.name", label: "Escalation contact", type: "text", hint: "Gets texted when the AI leasing agent needs a person." },
      { path: "escalation.mobile", label: "Escalation contact's mobile", type: "text" },
    ],
  },
  {
    title: "Rental criteria",
    description: "Applied the same way to every applicant.",
    fields: [
      { path: "screening.incomeMultiple", label: "Household income must be at least (× monthly rent)", type: "number" },
      { path: "screening.creditTierScore", label: "Credit score for a standard deposit", type: "number", hint: "No minimum score. Below this, the deposit is higher." },
      { path: "screening.depositMonthsAtOrAboveTier", label: "Deposit at or above that score (months of rent)", type: "months" },
      { path: "screening.depositMonthsBelowTierMin", label: "Deposit below that score: lowest (months)", type: "months" },
      { path: "screening.depositMonthsBelowTierMax", label: "Deposit below that score: highest (months)", type: "months" },
      { path: "screening.evictionLookbackYears", label: "Decline evictions within (years)", type: "number" },
      { path: "screening.declineIfOwesLandlord", label: "Decline if money is owed to a past landlord", type: "boolean" },
      { path: "screening.reviewUtilityOrCarPaymentProblems", label: "Send late utility or car payments to a person for review", type: "boolean" },
    ],
  },
  {
    title: "Application fees",
    fields: [
      { path: "fees.applicationFeePerAdultCents", label: "Application fee per adult", type: "money" },
      { path: "fees.adminFeeCents", label: "Admin fee", type: "money" },
      { path: "fees.refundAdminFeeIfDenied", label: "Refund the admin fee if the application is denied", type: "boolean" },
    ],
  },
  {
    title: "Lease terms",
    fields: [
      { path: "lease.minTermMonths", label: "Shortest lease (months)", type: "number" },
      { path: "lease.maxTermMonths", label: "Longest lease (months)", type: "number" },
      { path: "lease.shortTermUnderMonths", label: "Short-term surcharge applies under (months)", type: "number" },
      { path: "lease.shortTermSurchargeCents", label: "Short-term surcharge per month", type: "money" },
      { path: "lease.longTermYearlyIncreasePercent", label: "Leases over 12 months: rent increase each year", type: "percent", hint: "Written into the lease. Florida law sets no maximum lease length; leases over a year need the flood disclosure." },
    ],
  },
  {
    title: "Lease expirations",
    description: "Parcel Manage suggests lease lengths that keep move-outs spread out, so you never have too many units turning over in one month.",
    fields: [
      { path: "expirations.maxSharePercent", label: "Most leases ending in one month (% of units)", type: "percent", hint: "Applied to the whole portfolio and to each property (at least 1 unit)." },
      { path: "expirations.avoidMonths", label: "Months to avoid for lease endings (one per line)", type: "list", hint: "e.g. November, December, January: slow months to re-lease." },
      { path: "expirations.renewalOfferDays", label: "Start renewal offers (days before the lease ends)", type: "number" },
      { path: "renewal.defaultIncreasePercent", label: "Renewal offers: default rent increase", type: "percent", hint: "Filled in on each offer; you can type a different increase per tenant." },
      { path: "renewal.mtmFeeCents", label: "Renewal offers: month-to-month fee", type: "money", hint: "Added to the new rent every month the tenant is month-to-month." },
      { path: "renewal.mtmMaxMonths", label: "Renewal offers: most months month-to-month", type: "number", hint: "After this, the tenant renews or moves out. Ending a month-to-month tenancy takes written notice at least 30 days before the end of a monthly period (Fla. Stat. 83.57(3)); Parcel Manage reminds you when it's due." },
    ],
  },
  {
    title: "Pets",
    description: "Assistance animals are not pets: no pet fees, limits or breed rules apply to them (fair housing law).",
    fields: [
      { path: "pets.maxPets", label: "Most pets allowed", type: "number" },
      { path: "pets.petFeeCents", label: "One-time pet fee", type: "money" },
      { path: "pets.petRentPerPetCents", label: "Pet rent per pet, per month", type: "money" },
      { path: "pets.restrictedBreeds", label: "Restricted breeds (one per line)", type: "list", hint: "Check this against your landlord insurance exclusions." },
    ],
  },
  {
    title: "Rent and payments",
    fields: [
      { path: "rent.dueDay", label: "Rent due on day", type: "number" },
      { path: "rent.lateFeeDay", label: "Late fee posts on day", type: "number" },
      { path: "rent.lateFeeCents", label: "Late fee", type: "money", hint: "Must also be written in the lease." },
      { path: "rent.lateFeeDailyCents", label: "Daily late fee after that", type: "money", hint: "Each day rent is still unpaid after the late fee posts. $0 for none." },
      { path: "rent.lateFeeDailyMaxCents", label: "Most daily late fees in a month", type: "money", hint: "A cap on the daily fees (the first late fee isn't counted). $0 for no cap." },
      { path: "rent.cardCostPercent", label: "Credit card fee: your processor's percent", type: "percent", hint: "Tenants paying by credit card pay what the processor charges you (Stripe: 2.9% + 30¢), never more than 3%. Debit cards and bank transfers are free." },
      { path: "rent.cardCostFixedCents", label: "Credit card fee: your processor's fixed charge", type: "money", hint: "Per payment (Stripe: $0.30)." },
      { path: "rent.onlineOnly", label: "Tenants pay online only", type: "boolean", hint: "Rent is paid only through the resident portal (bank or card). Certified funds are still taken for move-in funds and after a returned payment, as the lease says." },
    ],
  },
  {
    title: "Maintenance",
    fields: [
      { path: "maintenance.falseEmergencyFeeCents", label: "False-emergency fee (plus the vendor's emergency charge)", type: "money", hint: "Must also be in the lease or a maintenance addendum." },
      { path: "maintenance.acEmergencyAboveF", label: "AC outage is an emergency above (°F inside)", type: "number" },
      { path: "maintenance.noHeatEmergencyBelowF", label: "No heat is an emergency below (°F inside)", type: "number" },
      { path: "maintenance.entryNoticeHours", label: "Notice before entering for repairs (hours)", type: "number", hint: "Florida law: at least 24 hours (Fla. Stat. 83.53(2))." },
      { path: "maintenance.entryWindowStart", label: "Repair visits start no earlier than", type: "time", hint: "Florida law: 7:30 AM at the earliest." },
      { path: "maintenance.entryWindowEnd", label: "Repair visits end no later than", type: "time", hint: "Florida law: 8:00 PM at the latest." },
    ],
  },
  {
    title: "Showings",
    fields: [
      { path: "showings.runBy", label: "Showings run by", type: "text" },
      { path: "showings.start", label: "Weekday showings from", type: "time" },
      { path: "showings.end", label: "Weekday showings until", type: "time" },
      { path: "showings.slotMinutes", label: "Slot length (minutes)", type: "number" },
      { path: "showings.bufferMinutes", label: "Buffer between showings (minutes)", type: "number" },
    ],
  },
];

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, key) => (o as Record<string, unknown> | undefined)?.[key], obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = obj;
  for (const key of keys.slice(0, -1)) cur = (cur[key] ??= {}) as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
}

// Value as the form shows it (money in dollars, lists one per line).
export function displayValue(field: RuleField, rules: BusinessRules): string | boolean {
  const v = getPath(rules, field.path);
  if (field.type === "boolean") return Boolean(v);
  if (field.type === "money") return (Number(v) / 100).toFixed(2);
  if (field.type === "list") return (v as string[]).join("\n");
  return String(v ?? "");
}

export type RulesParseResult = { ok: true; rules: BusinessRules } | { ok: false; errors: Record<string, string> };

export function parseRulesForm(form: FormData): RulesParseResult {
  const raw: Record<string, unknown> = {};
  for (const section of RULE_SECTIONS) {
    for (const field of section.fields) {
      const value = form.get(field.path);
      let parsed: unknown;
      switch (field.type) {
        case "boolean":
          parsed = value === "on";
          break;
        case "money": {
          const dollars = Number(String(value ?? "").replace(/[$,\s]/g, ""));
          parsed = Number.isFinite(dollars) ? Math.round(dollars * 100) : NaN;
          break;
        }
        case "list":
          parsed = String(value ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          break;
        case "text":
        case "time":
          parsed = String(value ?? "").trim();
          break;
        default:
          parsed = String(value ?? "").trim() === "" ? NaN : Number(value);
      }
      setPath(raw, field.path, parsed);
    }
  }
  const result = businessRulesSchema.safeParse(raw);
  if (result.success) return { ok: true, rules: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message.startsWith("Invalid input") || issue.message.startsWith("Too") ? "Check this value." : issue.message;
  }
  return { ok: false, errors };
}

export { DEFAULT_BUSINESS_RULES };
