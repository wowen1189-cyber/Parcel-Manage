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
  // Existing tenant renews.
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
  renewalFeeCents: 0,
};

function parse(stored: unknown, base: ManagementFee): ManagementFee | null {
  if (!stored || typeof stored !== "object" || !Object.keys(stored).length) return null;
  const parsed = managementFeeSchema.safeParse({ ...base, ...(stored as object) });
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

const dollars = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Plain-language summary, e.g. "8% of rent collected (at least $100) · leasing 50% of a month · renewal $150". */
export function describeFee(fee: ManagementFee): string {
  const monthly =
    fee.basis === "none"
      ? "No monthly fee"
      : fee.basis === "flat"
        ? `${dollars(fee.flatCents)} a month`
        : fee.basis === "per_unit"
          ? `${dollars(fee.flatCents)} per occupied unit a month`
          : `${fee.percent}% of rent collected${fee.minimumCents ? ` (at least ${dollars(fee.minimumCents)})` : ""}`;
  const parts = [monthly];
  if (fee.leasingFee === "percent" && fee.leasingPercent) parts.push(`leasing ${fee.leasingPercent}% of a month`);
  if (fee.leasingFee === "flat" && fee.leasingFlatCents) parts.push(`leasing ${dollars(fee.leasingFlatCents)}`);
  if (fee.renewalFeeCents) parts.push(`renewal ${dollars(fee.renewalFeeCents)}`);
  return parts.join(" · ");
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
  return { fee };
}
