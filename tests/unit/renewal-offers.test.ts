import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_RULES } from "@/lib/business-rules";
import { checkChoices, increasedRent, mtmChoice, termChoice } from "@/lib/renewal-offers";

const rules = DEFAULT_BUSINESS_RULES;

describe("renewal offers", () => {
  it("raises rent by the increase, to the cent", () => {
    expect(increasedRent(150000, 3)).toBe(154500);
    expect(increasedRent(97152, 3)).toBe(100067);
    expect(increasedRent(150000, 0)).toBe(150000);
  });

  it("prices a 12-month lease at the new rent, a short one with the surcharge, a long one with the yearly increase", () => {
    expect(termChoice({ currentRentCents: 150000, increasePercent: 3, start: "2027-01-01", months: 12, endDate: "2027-12-31", rules })).toMatchObject({ rentCents: 154500, surchargeCents: 0, yearlyIncreasePercent: null });
    expect(termChoice({ currentRentCents: 150000, increasePercent: 3, start: "2027-01-01", months: 9, endDate: "2027-09-30", rules }).rentCents).toBe(154500 + rules.lease.shortTermSurchargeCents);
    expect(termChoice({ currentRentCents: 150000, increasePercent: 3, start: "2027-01-01", months: 15, endDate: "2028-03-31", rules }).yearlyIncreasePercent).toBe(rules.lease.longTermYearlyIncreasePercent);
  });

  it("month-to-month adds the $150 fee and lasts at most 3 months, with notice due 30 days before (83.57(3))", () => {
    const m = mtmChoice({ currentRentCents: 150000, increasePercent: 3, start: "2027-01-01", rules });
    expect(m.rentCents).toBe(154500 + 15000);
    expect(m.lastDay).toBe("2027-03-31");
    expect(m.noticeBy).toBe("2027-03-01");
    // A mid-month start: monthly periods run from that day.
    expect(mtmChoice({ currentRentCents: 100000, increasePercent: 0, start: "2027-01-11", rules }).lastDay).toBe("2027-04-10");
  });

  it("allows up to three options with at most one month-to-month and no repeated lengths", () => {
    const t = (months: number) => termChoice({ currentRentCents: 100000, increasePercent: 3, start: "2027-01-01", months, endDate: "2027-12-31", rules });
    const m = mtmChoice({ currentRentCents: 100000, increasePercent: 3, start: "2027-01-01", rules });
    expect(checkChoices([t(12), t(15), m])).toBeNull();
    expect(checkChoices([])).toBe("Add at least one option.");
    expect(checkChoices([t(12), t(13), t(14), m])).toBe("Offer at most 3 options.");
    expect(checkChoices([m, m])).toBe("Only one month-to-month option.");
    expect(checkChoices([t(12), t(12)])).toBe("Two options have the same length.");
  });
});
