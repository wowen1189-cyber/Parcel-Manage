import { describe, expect, it } from "vitest";
import { DEFAULT_MANAGEMENT_FEE, describeFee, effectiveFee, feeFromForm, leasingFee, monthlyFee, readCompanyFee, renewalFee, type ManagementFee } from "@/lib/management-fees";

const fee = (f: Partial<ManagementFee>): ManagementFee => ({ ...DEFAULT_MANAGEMENT_FEE, ...f });

describe("monthly management fee", () => {
  it("takes a percent of gross income collected, rounded to the cent", () => {
    expect(monthlyFee(fee({ percent: 8 }), 145_000, 1)).toBe(11_600);
    expect(monthlyFee(fee({ percent: 7.5 }), 123_456, 1)).toBe(9_259);
  });
  it("never goes below the minimum when rent comes in", () => {
    expect(monthlyFee(fee({ percent: 8, minimumCents: 10_000 }), 50_000, 1)).toBe(10_000);
  });
  it("charges nothing on an empty month unless the agreement says to", () => {
    expect(monthlyFee(fee({ percent: 8, minimumCents: 10_000 }), 0, 0)).toBe(0);
    expect(monthlyFee(fee({ percent: 8, minimumCents: 10_000, chargeWhenVacant: true }), 0, 0)).toBe(10_000);
    // A monthly cap: 8% of $10,000 is $800, capped at $500; below the cap the percent applies.
    expect(monthlyFee(fee({ percent: 8, maximumCents: 50_000 }), 1_000_000, 4)).toBe(50_000);
    expect(monthlyFee(fee({ percent: 8, maximumCents: 50_000 }), 200_000, 1)).toBe(16_000);
    expect(monthlyFee(fee({ percent: 8, minimumCents: 10_000, maximumCents: 50_000 }), 50_000, 1)).toBe(10_000);
    expect(monthlyFee(fee({ basis: "flat", flatCents: 9_900 }), 0, 0)).toBe(0);
    expect(monthlyFee(fee({ basis: "flat", flatCents: 9_900, chargeWhenVacant: true }), 0, 0)).toBe(9_900);
  });
  it("supports flat, per occupied unit and none", () => {
    expect(monthlyFee(fee({ basis: "flat", flatCents: 9_900 }), 200_000, 2)).toBe(9_900);
    expect(monthlyFee(fee({ basis: "per_unit", flatCents: 5_000 }), 900_000, 17)).toBe(85_000);
    expect(monthlyFee(fee({ basis: "none" }), 200_000, 2)).toBe(0);
  });
});

describe("leasing fee", () => {
  it("is a share of a month's rent, a flat amount or none", () => {
    expect(leasingFee(fee({ leasingFee: "percent", leasingPercent: 50 }), 145_000)).toBe(72_500);
    expect(leasingFee(fee({ leasingFee: "flat", leasingFlatCents: 30_000 }), 145_000)).toBe(30_000);
    expect(leasingFee(fee({ leasingFee: "none" }), 145_000)).toBe(0);
  });
});

describe("renewal fee", () => {
  it("is a share of a month's rent, a flat amount or none", () => {
    expect(renewalFee(fee({ renewalFee: "percent", renewalPercent: 25 }), 150_000)).toBe(37_500);
    expect(renewalFee(fee({ renewalFee: "flat", renewalFeeCents: 15_000 }), 150_000)).toBe(15_000);
    expect(renewalFee(fee({ renewalFee: "none", renewalFeeCents: 15_000 }), 150_000)).toBe(0);
  });
  it("reads an older saved renewal amount as a flat fee", () => {
    const { renewalFee: kind, ...older } = { ...DEFAULT_MANAGEMENT_FEE, renewalFeeCents: 15_000 };
    expect(kind).toBe("none");
    expect(readCompanyFee({ managementFee: older }).renewalFee).toBe("flat");
  });
});

describe("which fee applies", () => {
  const company = fee({ percent: 8 });
  it("uses the property's own fee, then the owner's agreement, then the company default", () => {
    expect(effectiveFee(null, {}, company)).toEqual({ fee: company, source: "company" });
    expect(effectiveFee(null, { ...company, percent: 10 }, company)).toMatchObject({ fee: { percent: 10 }, source: "owner" });
    expect(effectiveFee({ ...company, percent: 6 }, { ...company, percent: 10 }, company)).toMatchObject({ fee: { percent: 6 }, source: "property" });
  });
  it("ignores a broken saved fee instead of failing", () => {
    expect(effectiveFee({ basis: "weird" }, null, company).source).toBe("company");
  });
  it("reads the company default from settings", () => {
    expect(readCompanyFee({})).toEqual(DEFAULT_MANAGEMENT_FEE);
    expect(readCompanyFee({ managementFee: { ...DEFAULT_MANAGEMENT_FEE, percent: 9 } }).percent).toBe(9);
  });
});

describe("fee form", () => {
  it("reads dollars and percents", () => {
    const { fee: f } = feeFromForm({ basis: "percent", percent: "8%", minimum: "$100", leasingFee: "flat", leasingFlat: "300", renewalFee: "flat", renewal: "150.50" });
    expect(f).toMatchObject({ basis: "percent", percent: 8, minimumCents: 10_000, leasingFlatCents: 30_000, renewalFee: "flat", renewalFeeCents: 15_050, chargeWhenVacant: false });
  });
  it("explains bad input", () => {
    expect(feeFromForm({ basis: "percent", percent: "", leasingFee: "none" }).error).toMatch(/percent/);
    expect(feeFromForm({ basis: "flat", flat: "abc", leasingFee: "none" }).error).toMatch(/dollars/);
    expect(feeFromForm({ basis: "percent", percent: "150", leasingFee: "none" }).error).toMatch(/between 0 and 100/);
    expect(feeFromForm({ basis: "percent", percent: "8", leasingFee: "none", renewalFee: "percent" }).error).toMatch(/renewal fee percent/);
  });
  it("describes the terms in plain words", () => {
    expect(describeFee(fee({ percent: 8, minimumCents: 10_000, leasingPercent: 50, renewalFee: "flat", renewalFeeCents: 15_000 }))).toBe("Management 8% of gross income collected (at least $100 a month) · Leasing 50% of a month's rent · Renewal $150");
    expect(describeFee(fee({ percent: 5, leasingFee: "none" }))).toBe("Management 5% of gross income collected · Leasing none · Renewal none");
  });
  it("caps the percent fee and describes the cap", () => {
    expect(describeFee(fee({ percent: 8, minimumCents: 10_000, maximumCents: 50_000, leasingFee: "none" }))).toBe("Management 8% of gross income collected (at least $100, at most $500 a month) · Leasing none · Renewal none");
    expect(feeFromForm({ basis: "percent", percent: "8", minimum: "100", maximum: "50", leasingFee: "none" }).error).toMatch(/maximum can't be less/);
    expect(feeFromForm({ basis: "percent", percent: "8", maximum: "500", leasingFee: "none" }).fee?.maximumCents).toBe(50_000);
  });
});
