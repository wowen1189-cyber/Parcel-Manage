// Management fees: what the management company earns for running each property, per the owner's
// management agreement. Set once on the owner (entity.management_fee) and used by every property the
// owner has; a property can carry its own fee instead (property.management_fee). Owners without one
// use the company default (company.settings.managementFee).
//
// The fee comes out of the owner's money, never the tenant's, so Florida ch. 83 doesn't set it; the
// signed management agreement does. Money is integer cents.

import { z } from "zod";

const cents = z.coerce.number().int().min(0).max(100_000_00);
const percent = z.coerce.number().min(0).max(100);

export const managementFeeSchema = z.object({
  // percent: a share of the rent collected that month. flat: a set amount per property per month.
  // per_unit: a set amount per occupied unit per month. none: no monthly fee.
  basis: z.enum(["percent", "flat", "per_unit", "none"]),
  percent,
  flatCents: cents,
  // Percent fees: never less than this in a month when the fee applies.
  minimumCents: cents,
  // When nothing was collected (vacant or unpaid), still charge the minimum or flat fee.
  chargeWhenVacant: z.boolean(),
  // New lease signed: a share of one month's rent, or a set amount.
  leasingFee: z.enum(["percent", "flat", "none"]),
  leasingPercent: percent,
  leasingFlatCents: cents,
  // Existing tenant renews: a share of one month's (new) rent, or a set amount.
  renewalFee: z.enum(["percent", "flat", "none"]),
  renewalPercent: percent,
  renewalFeeCents: cents,
});
export type ManagementFee = z.infer<typeof managementFeeSchema>;

/** Starting values for a new company until it enters its own agreement terms. */
export const DEFAULT_MANAGEMENT_FEE: ManagementFee = {
  basis: "percent",
  percent: 8,
  flatCents: 0,
  minimumCents: 0,
  chargeWhenVacant: false,
  leasingFee: "percent",
  leasingPercent: 50,
  leasingFlatCents: 0,
  renewalFee: "none",
  renewalPercent: 0,
  renewalFeeCents: 0,
};

function parse(stored: unknown, base: ManagementFee): ManagementFee | null {
  if (!stored || typeof stored !== "object" || !Object.keys(stored).length) return null;
  const saved = stored as Partial<ManagementFee>;
  // Fees saved before renewal fees had a type: a renewal amount meant a flat fee.
  const renewal = saved.renewalFee ?? (saved.renewalFeeCents ? "flat" : "none");
  const parsed = managementFeeSchema.safeParse({ ...base, ...saved, renewalFee: renewal });
  return parsed.success ? parsed.data : null;
}

/** The company default, from company.settings.managementFee. */
export function readCompanyFee(settings: unknown): ManagementFee {
  const stored = settings && typeof settings === "object" ? (settings as { managementFee?: unknown }).managementFee : undefined;
  return parse(stored, DEFAULT_MANAGEMENT_FEE) ?? DEFAULT_MANAGEMENT_FEE;
}

export type FeeSource = "property" | "owner" | "company";
export const FEE_SOURCE_LABEL: Record<FeeSource, string> = {
  property: "This property's own fee",
  owner: "Owner's agreement",
  company: "Company default",
};

/** The fee that applies to a property: its own, else its owner's, else the company default. */
export function effectiveFee(propertyFee: unknown, ownerFee: unknown, companyFee: ManagementFee): { fee: ManagementFee; source: FeeSource } {
  const owner = parse(ownerFee, companyFee);
  const property = parse(propertyFee, owner ?? companyFee);
  if (property) return { fee: property, source: "property" };
  if (owner) return { fee: owner, source: "owner" };
  return { fee: companyFee, source: "company" };
}

/** The monthly management fee for one property, from the rent collected that month. */
export function monthlyFee(fee: ManagementFee, collectedCents: number, occupiedUnits: number): number {
  if (fee.basis === "none") return 0;
  if (collectedCents <= 0 && !fee.chargeWhenVacant) return 0;
  if (fee.basis === "flat") return fee.flatCents;
  if (fee.basis === "per_unit") return fee.flatCents * occupiedUnits;
  return Math.max(Math.round((Math.max(collectedCents, 0) * fee.percent) / 100), fee.minimumCents);
}

/** One-time fee when a new lease is signed. */
export function leasingFee(fee: ManagementFee, monthlyRentCents: number): number {
  if (fee.leasingFee === "none") return 0;
  if (fee.leasingFee === "flat") return fee.leasingFlatCents;
  return Math.round((monthlyRentCents * fee.leasingPercent) / 100);
}

/** One-time fee when an existing tenant renews, from the renewal's monthly rent. */
export function renewalFee(fee: ManagementFee, monthlyRentCents: number): number {
  if (fee.renewalFee === "none") return 0;
  if (fee.renewalFee === "flat") return fee.renewalFeeCents;
  return Math.round((monthlyRentCents * fee.renewalPercent) / 100);
}

const dollars = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Plain-language summary of the three fees, e.g. "Management 8% of rent collected · Leasing 50% of a month's rent · Renewal $150". */
export function describeFee(fee: ManagementFee): string {
  return describeFeeParts(fee).map((x) => `${x.label} ${x.text}`).join(" · ");
}

/** The management, leasing and renewal fee, each in plain words. */
export function describeFeeParts(fee: ManagementFee): { label: string; text: string }[] {
  const monthly =
    fee.basis === "none"
      ? "none"
      : fee.basis === "flat"
        ? `${dollars(fee.flatCents)} a month`
        : fee.basis === "per_unit"
          ? `${dollars(fee.flatCents)} per occupied unit a month`
          : `${fee.percent}% of rent collected${fee.minimumCents ? ` (at least ${dollars(fee.minimumCents)})` : ""}`;
  const oneTime = (kind: "percent" | "flat" | "none", pct: number, flat: number) =>
    kind === "percent" && pct ? `${pct}% of a month's rent` : kind === "flat" && flat ? dollars(flat) : "none";
  return [
    { label: "Management", text: monthly },
    { label: "Leasing", text: oneTime(fee.leasingFee, fee.leasingPercent, fee.leasingFlatCents) },
    { label: "Renewal", text: oneTime(fee.renewalFee, fee.renewalPercent, fee.renewalFeeCents) },
  ];
}

/** Reads the fee form (dollar and percent text fields) into a fee. */
export function feeFromForm(raw: Record<string, FormDataEntryValue>): { fee?: ManagementFee; error?: string } {
  const money = (k: string) => {
    const v = String(raw[k] ?? "").replace(/[$,\s]/g, "");
    if (!v) return 0;
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return NaN;
    return Math.round(Number(v) * 100);
  };
  const pct = (k: string) => {
    const v = String(raw[k] ?? "").replace(/[%\s]/g, "");
    return v ? Number(v) : 0;
  };
  const candidate = {
    basis: raw.basis,
    percent: pct("percent"),
    flatCents: money("flat"),
    minimumCents: money("minimum"),
    chargeWhenVacant: raw.chargeWhenVacant === "on",
    leasingFee: raw.leasingFee,
    leasingPercent: pct("leasingPercent"),
    leasingFlatCents: money("leasingFlat"),
    renewalFee: raw.renewalFee ?? "none",
    renewalPercent: pct("renewalPercent"),
    renewalFeeCents: money("renewal"),
  };
  const bad = Object.entries(candidate).find(([, v]) => typeof v === "number" && Number.isNaN(v));
  if (bad) return { error: "Enter amounts as dollars, like 150 or 99.50." };
  const parsed = managementFeeSchema.safeParse(candidate);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0].path[0]);
    return { error: field.toLowerCase().includes("percent") ? "Enter percents between 0 and 100." : "Check the fee amounts." };
  }
  const fee = parsed.data;
  if (fee.basis === "percent" && !fee.percent) return { error: "Enter the percent of rent, or choose no monthly fee." };
  if ((fee.basis === "flat" || fee.basis === "per_unit") && !fee.flatCents) return { error: "Enter the monthly amount, or choose no monthly fee." };
  if (fee.leasingFee === "percent" && !fee.leasingPercent) return { error: "Enter the leasing fee percent, or choose no leasing fee." };
  if (fee.leasingFee === "flat" && !fee.leasingFlatCents) return { error: "Enter the leasing fee amount, or choose no leasing fee." };
  if (fee.renewalFee === "percent" && !fee.renewalPercent) return { error: "Enter the renewal fee percent, or choose no renewal fee." };
  if (fee.renewalFee === "flat" && !fee.renewalFeeCents) return { error: "Enter the renewal fee amount, or choose no renewal fee." };
  return { fee };
}
