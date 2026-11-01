import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_RULES, businessRulesSchema } from "@/lib/business-rules";
import { calendar, countExpirations, expirationMonth, leaseEndDate, monthlyCap, recommendTerms, type LeaseEnd } from "@/lib/lease-expirations";

const rules = DEFAULT_BUSINESS_RULES; // 7–24 months, 12% cap, avoid Nov/Dec/Jan

describe("lease end dates", () => {
  it("ends on the last day of the month", () => {
    expect(leaseEndDate("2026-07-01", 12)).toBe("2027-06-30");
    expect(leaseEndDate("2026-07-15", 12)).toBe("2027-07-31");
    expect(leaseEndDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(leaseEndDate("2026-11-01", 24)).toBe("2028-10-31");
  });

  it("uses the move-out month for leases on notice and skips month-to-month", () => {
    expect(expirationMonth({ endDate: "2027-05-31", status: "active", moveOutOn: null })).toBe("2027-05");
    expect(expirationMonth({ endDate: "2027-05-31", status: "notice", moveOutOn: "2026-11-30" })).toBe("2026-11");
    expect(expirationMonth({ endDate: null, status: "active", moveOutOn: null })).toBeNull();
  });
});

describe("monthly cap", () => {
  it("allows 12% of units, at least one", () => {
    expect(monthlyCap(60, 12)).toBe(7);
    expect(monthlyCap(20, 12)).toBe(2);
    expect(monthlyCap(4, 12)).toBe(1);
    expect(monthlyCap(25, 12)).toBe(3);
  });
});

describe("recommendTerms", () => {
  const lease = (id: string, propertyId: string, endDate: string): LeaseEnd => ({ leaseId: id, propertyId, endDate, status: "active", moveOutOn: null });

  it("recommends 12 months when that month has room", () => {
    const counts = countExpirations([]);
    const options = recommendTerms({ start: "2026-07-01", propertyId: "p", propertyUnits: 20, portfolioUnits: 60, counts, rules });
    expect(options.map((o) => o.months)).toEqual(Array.from({ length: 18 }, (_, i) => i + 7));
    expect(options.find((o) => o.recommended)).toMatchObject({ months: 12, endDate: "2027-06-30", status: "good" });
  });

  it("steers around a month that is full at this property", () => {
    const counts = countExpirations([lease("a", "p", "2027-06-30"), lease("b", "p", "2027-06-15")]);
    const options = recommendTerms({ start: "2026-07-01", propertyId: "p", propertyUnits: 20, portfolioUnits: 60, counts, rules });
    expect(options.find((o) => o.months === 12)).toMatchObject({ status: "full" });
    const best = options.find((o) => o.recommended)!;
    expect([11, 13]).toContain(best.months);
    expect(best.status).toBe("good");
  });

  it("avoids holiday months and adds the short-term surcharge under 12 months", () => {
    const options = recommendTerms({ start: "2026-12-01", propertyId: "p", propertyUnits: 20, portfolioUnits: 60, counts: countExpirations([]), rules });
    expect(options.find((o) => o.months === 12)).toMatchObject({ endMonth: "2027-11", status: "avoid" });
    const best = options.find((o) => o.recommended)!;
    expect(best.status).toBe("good");
    // 12 ends in November and 13–14 in Dec/Jan, so the best is 11 (October) or 15 (February).
    expect([11, 15]).toContain(best.months);
    expect(options.find((o) => o.months === 10)!.surchargeCents).toBe(5000);
    expect(options.find((o) => o.months === 14)!.surchargeCents).toBe(0);
  });

  it("ignores the lease being renewed when counting its own month", () => {
    const counts = countExpirations([lease("self", "p", "2027-06-30")], "self");
    expect(counts.portfolio.get("2027-06")).toBeUndefined();
  });
});

describe("calendar and settings", () => {
  it("flags months over the cap and months to avoid", () => {
    const counts = countExpirations([0, 1, 2].map((i) => ({ leaseId: String(i), propertyId: "p", endDate: "2027-01-31", status: "active", moveOutOn: null })));
    const cells = calendar(counts.portfolio, 20, "2026-12", 3, rules);
    expect(cells.map((c) => [c.month, c.count, c.cap, c.over, c.avoid])).toEqual([
      ["2026-12", 0, 2, false, true],
      ["2027-01", 3, 2, true, true],
      ["2027-02", 0, 2, false, false],
    ]);
  });

  it("accepts loosely typed month names in settings", () => {
    const parsed = businessRulesSchema.safeParse({ ...rules, expirations: { ...rules.expirations, avoidMonths: ["nov", "Dec"] } });
    expect(parsed.success && parsed.data.expirations.avoidMonths).toEqual(["November", "December"]);
  });
});
