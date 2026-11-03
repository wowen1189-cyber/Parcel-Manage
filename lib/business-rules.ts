import { z } from "zod";

// Company business rules (docs/02-business-rules.md). Stored in company.settings.businessRules.
// Every value is a company setting; SIM REI's values are the defaults below.
// Money is integer cents. Values the law fixes are not settings and live in FLORIDA_LAW.

// Florida law, Chapter 83 (docs/reference/florida-chapter-83-landlord-tenant-2025.html).
export const FLORIDA_LAW = {
  // Fla. Stat. 83.53(2): repair entry needs at least 24 hours' notice, between 7:30 AM and 8:00 PM.
  entryNoticeMinHours: 24,
  entryWindowEarliest: "07:30",
  entryWindowLatest: "20:00",
  // Fla. Stat. 83.49(3)(a): return the deposit within 15 days, or send notice of intent to claim
  // by certified mail within 30 days; the tenant then has 15 days to object.
  depositReturnDays: 15,
  depositClaimNoticeDays: 30,
  depositObjectionDays: 15,
} as const;

const cents = z.coerce.number().int().min(0);
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 10:00");

export const businessRulesSchema = z
  .object({
    office: z.object({
      hours: z.string().min(1).max(80),
    }),
    escalation: z.object({
      name: z.string().min(1).max(80),
      mobile: z.string().min(7).max(30),
    }),
    screening: z.object({
      // Checkr Tenant package ordered by default (Wesley Owen, Nov 2, 2026: essential); staff can pick another per order.
      checkrPackage: z.enum(["starter", "essential", "complete"]).default("essential"),
      incomeMultiple: z.coerce.number().min(1).max(5),
      creditTierScore: z.coerce.number().int().min(300).max(850),
      depositMonthsAtOrAboveTier: z.coerce.number().min(0).max(3),
      depositMonthsBelowTierMin: z.coerce.number().min(0).max(3),
      depositMonthsBelowTierMax: z.coerce.number().min(0).max(3),
      evictionLookbackYears: z.coerce.number().int().min(0).max(10),
      declineIfOwesLandlord: z.coerce.boolean(),
      reviewUtilityOrCarPaymentProblems: z.coerce.boolean(),
    }),
    fees: z.object({
      applicationFeePerAdultCents: cents,
      adminFeeCents: cents,
      refundAdminFeeIfDenied: z.coerce.boolean(),
    }),
    lease: z.object({
      minTermMonths: z.coerce.number().int().min(1).max(36),
      maxTermMonths: z.coerce.number().int().min(1).max(60),
      shortTermUnderMonths: z.coerce.number().int().min(1).max(36),
      shortTermSurchargeCents: cents,
      // Leases longer than 12 months: yearly rent step written into the lease (a fixed-term lease can't be changed mid-term).
      longTermYearlyIncreasePercent: z.coerce.number().min(0).max(25),
    }),
    // Lease expiration management: keep move-outs spread across the year.
    expirations: z.object({
      maxSharePercent: z.coerce.number().min(1).max(100),
      avoidMonths: z
        .array(
          z.preprocess(
            (v) => (typeof v === "string" ? (MONTH_NAMES.find((m) => m.toLowerCase().startsWith(v.trim().toLowerCase().slice(0, 3))) ?? v) : v),
            z.enum(MONTH_NAMES, { error: "Use month names, like November." }),
          ),
        )
        .max(11, "Leave at least one month open."),
      renewalOfferDays: z.coerce.number().int().min(30).max(180),
    }),
    // Renewal offers (Wesley Owen, Nov 2, 2026): a default increase the office can change per offer; up to three
    // options, one of them month-to-month at the new rent plus a monthly fee, for a limited number of months.
    renewal: z.object({
      defaultIncreasePercent: z.coerce.number().min(0).max(25),
      mtmFeeCents: cents,
      mtmMaxMonths: z.coerce.number().int().min(1).max(12),
    }),
    pets: z.object({
      maxPets: z.coerce.number().int().min(0).max(10),
      petFeeCents: cents,
      petRentPerPetCents: cents,
      restrictedBreeds: z.array(z.string().min(1).max(60)).max(50),
    }),
    rent: z.object({
      dueDay: z.coerce.number().int().min(1).max(28),
      lateFeeCents: cents,
      lateFeeDay: z.coerce.number().int().min(2).max(28),
      // Then a fee each day rent is still unpaid, up to a monthly maximum for the daily fees (0 = no daily fee;
      // max 0 = no maximum). Florida (ch. 83 Part II) sets no amount; the lease must state it.
      lateFeeDailyCents: cents,
      lateFeeDailyMaxCents: cents,
      // What the card processor charges the company per credit card payment (Stripe: 2.9% + 30¢). Tenants
      // paying by credit card pay this cost, never more than 3%; debit cards and bank transfers are free.
      cardCostPercent: z.coerce.number().min(0).max(3),
      cardCostFixedCents: cents,
      // Tenants pay only through Parcel Manage (Stripe ACH or card); the only exception is certified funds
      // (move-in funds, or after a returned payment) taken by the office. Off: the portal also shows check
      // and money order instructions.
      onlineOnly: z.boolean(),
    }),
    maintenance: z.object({
      falseEmergencyFeeCents: cents,
      acEmergencyAboveF: z.coerce.number().int().min(70).max(100),
      noHeatEmergencyBelowF: z.coerce.number().int().min(30).max(70),
      // Fla. Stat. 83.53(2): never less than 24 hours.
      entryNoticeHours: z.coerce
        .number()
        .int()
        .min(FLORIDA_LAW.entryNoticeMinHours, "Florida law (83.53(2)) requires at least 24 hours' notice."),
      entryWindowStart: time,
      entryWindowEnd: time,
    }),
    showings: z.object({
      runBy: z.string().min(1).max(80),
      start: time,
      end: time,
      slotMinutes: z.coerce.number().int().min(10).max(120),
      bufferMinutes: z.coerce.number().int().min(0).max(120),
    }),
  })
  .superRefine((r, ctx) => {
    if (r.screening.depositMonthsBelowTierMin > r.screening.depositMonthsBelowTierMax) {
      ctx.addIssue({
        code: "custom",
        path: ["screening", "depositMonthsBelowTierMax"],
        message: "The highest deposit can't be lower than the lowest.",
      });
    }
    if (r.lease.minTermMonths > r.lease.maxTermMonths) {
      ctx.addIssue({ code: "custom", path: ["lease", "maxTermMonths"], message: "Longest term can't be shorter than the shortest." });
    }
    if (r.rent.lateFeeDay <= r.rent.dueDay) {
      ctx.addIssue({ code: "custom", path: ["rent", "lateFeeDay"], message: "The late fee must post after the due day." });
    }
    if (r.maintenance.entryWindowStart < FLORIDA_LAW.entryWindowEarliest) {
      ctx.addIssue({
        code: "custom",
        path: ["maintenance", "entryWindowStart"],
        message: "Florida law (83.53(2)) allows repair entry from 7:30 AM at the earliest.",
      });
    }
    if (r.maintenance.entryWindowEnd > FLORIDA_LAW.entryWindowLatest) {
      ctx.addIssue({
        code: "custom",
        path: ["maintenance", "entryWindowEnd"],
        message: "Florida law (83.53(2)) allows repair entry until 8:00 PM at the latest.",
      });
    }
    if (r.maintenance.entryWindowStart >= r.maintenance.entryWindowEnd) {
      ctx.addIssue({ code: "custom", path: ["maintenance", "entryWindowEnd"], message: "The end time must be after the start time." });
    }
    if (r.showings.start >= r.showings.end) {
      ctx.addIssue({ code: "custom", path: ["showings", "end"], message: "The end time must be after the start time." });
    }
  });

export type BusinessRules = z.infer<typeof businessRulesSchema>;

// SIM REI's rules, used as the defaults for every new company.
export const DEFAULT_BUSINESS_RULES: BusinessRules = {
  office: { hours: "Mon–Fri 9–5" },
  escalation: { name: "Wesley Owen", mobile: "(352) 434-9441" },
  screening: {
    checkrPackage: "essential",
    incomeMultiple: 2.5,
    creditTierScore: 620,
    depositMonthsAtOrAboveTier: 1,
    depositMonthsBelowTierMin: 1.5,
    depositMonthsBelowTierMax: 2,
    evictionLookbackYears: 5,
    declineIfOwesLandlord: true,
    reviewUtilityOrCarPaymentProblems: true,
  },
  fees: { applicationFeePerAdultCents: 7500, adminFeeCents: 8500, refundAdminFeeIfDenied: true },
  lease: { minTermMonths: 7, maxTermMonths: 24, shortTermUnderMonths: 12, shortTermSurchargeCents: 5000, longTermYearlyIncreasePercent: 3 },
  // Central Florida demand peaks in late spring and summer; holiday months are slow to re-lease.
  expirations: { maxSharePercent: 12, avoidMonths: ["November", "December", "January"], renewalOfferDays: 90 },
  renewal: { defaultIncreasePercent: 3, mtmFeeCents: 15000, mtmMaxMonths: 3 },
  pets: {
    maxPets: 2,
    petFeeCents: 35000,
    petRentPerPetCents: 2500,
    restrictedBreeds: [
      "Pit Bull",
      "Doberman Pinscher",
      "Rottweiler",
      "Great Dane",
      "Presa Canario",
      "Chow Chow",
      "German Shepherd",
      "Alaskan Malamute",
      "Akita",
      "Cane Corso",
      "Bull Mastiff",
      "Wolf Hybrid",
    ],
  },
  // SIM REI's late fee (Wesley Owen, Nov 2, 2026): $75 on the 4th, then $10 a day, up to $250 in daily fees.
  rent: { dueDay: 1, lateFeeCents: 7500, lateFeeDay: 4, lateFeeDailyCents: 1000, lateFeeDailyMaxCents: 25000, cardCostPercent: 2.9, cardCostFixedCents: 30, onlineOnly: true },
  maintenance: {
    falseEmergencyFeeCents: 10000,
    acEmergencyAboveF: 80,
    noHeatEmergencyBelowF: 55,
    entryNoticeHours: 24,
    entryWindowStart: "07:30",
    entryWindowEnd: "20:00",
  },
  showings: { runBy: "Wesley Owen", start: "10:00", end: "18:00", slotMinutes: 30, bufferMinutes: 15 },
};

// Read a company's rules from company.settings, filling any missing piece with the defaults.
export function readBusinessRules(settings: unknown): BusinessRules {
  const stored =
    settings && typeof settings === "object" && "businessRules" in settings
      ? (settings as { businessRules: unknown }).businessRules
      : undefined;
  const merged = mergeDeep(DEFAULT_BUSINESS_RULES, stored);
  const parsed = businessRulesSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_BUSINESS_RULES;
}

function mergeDeep<T>(base: T, override: unknown): T {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return (override === undefined ? base : (override as T)) ?? base;
  }
  if (!base || typeof base !== "object" || Array.isArray(base)) return override as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override)) {
    out[key] = mergeDeep((base as Record<string, unknown>)[key], value);
  }
  return out as T;
}
