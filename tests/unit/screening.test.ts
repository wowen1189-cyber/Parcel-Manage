import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_RULES } from "@/lib/business-rules";
import { applicationFees, depositFor, recommend, type ScreeningResult } from "@/lib/screening";

const rules = DEFAULT_BUSINESS_RULES.screening;
const clean: ScreeningResult = { creditScore: 700, evictionYearsAgo: null, owesLandlord: false, utilityOrCarProblems: false, criminalRecords: false };
const rent = 150000;

describe("screening recommendation", () => {
  it("approves at 620+ with income at 2.5× rent, one month's deposit", () => {
    const r = recommend(rules, rent, 375000, [clean]);
    expect(r.decision).toBe("approve");
    expect(r.depositMonths).toEqual({ min: 1, max: 1 });
    expect(r.adverseAction).toBe(false);
  });
  it("income is a hard minimum, and income alone isn't adverse action from a report", () => {
    const r = recommend(rules, rent, 374999, [clean]);
    expect(r.decision).toBe("decline");
    expect(r.adverseAction).toBe(false);
  });
  it("under 620 or no score: approve with 1.5–2× deposit and an adverse action notice", () => {
    const r = recommend(rules, rent, 400000, [{ ...clean, creditScore: 619 }]);
    expect(r.decision).toBe("approve_higher_deposit");
    expect(r.depositMonths).toEqual({ min: 1.5, max: 2 });
    expect(r.adverseAction).toBe(true);
    expect(recommend(rules, rent, 400000, [{ ...clean, creditScore: null }]).decision).toBe("approve_higher_deposit");
  });
  it("lowest score in the household sets the tier; incomes combine", () => {
    expect(recommend(rules, rent, 400000, [clean, { ...clean, creditScore: 600 }]).decision).toBe("approve_higher_deposit");
  });
  it("declines an eviction inside 5 years or a landlord balance", () => {
    expect(recommend(rules, rent, 400000, [{ ...clean, evictionYearsAgo: 4 }]).decision).toBe("decline");
    expect(recommend(rules, rent, 400000, [{ ...clean, evictionYearsAgo: 5 }]).decision).toBe("approve");
    const owes = recommend(rules, rent, 400000, [{ ...clean, owesLandlord: true }]);
    expect(owes.decision).toBe("decline");
    expect(owes.adverseAction).toBe(true);
  });
  it("sends utility/car problems and criminal records to a person, never auto-declines", () => {
    expect(recommend(rules, rent, 400000, [{ ...clean, utilityOrCarProblems: true }]).decision).toBe("review");
    expect(recommend(rules, rent, 400000, [{ ...clean, criminalRecords: true }]).decision).toBe("review");
  });
});

describe("fees and deposits", () => {
  it("charges the application fee per adult plus one admin fee", () => {
    expect(applicationFees(DEFAULT_BUSINESS_RULES.fees, 2)).toEqual({ applicationCents: 15000, adminCents: 8500, totalCents: 23500 });
  });
  it("rounds deposits to whole dollars", () => {
    expect(depositFor(145050, 1.5)).toBe(217600);
  });
});

import { readAnswers, sectionsFor } from "@/lib/application-form";

describe("application answers", () => {
  const form = (o: Record<string, string>) => {
    const f = new FormData();
    Object.entries(o).forEach(([k, v]) => f.set(k, v));
    return f;
  };
  const base = { first_name: "Pat", last_name: "Sample", email: "pat@example.com", phone: "555-0100", current_address: "1 Test St", monthly_income: "$4,250.50", move_in: "2026-12-01", occupants: "2" };
  it("reads income in cents and requires the main questions", () => {
    const r = readAnswers(sectionsFor("residential", "applicant"), form(base));
    expect("incomeCents" in r && r.incomeCents).toBe(425050);
    expect(readAnswers(sectionsFor("residential", "applicant"), form({ ...base, monthly_income: "" }))).toEqual({ error: "Please answer: Your gross monthly income ($)." });
  });
  it("co-applicants skip the household questions; commercial asks about the business", () => {
    expect(sectionsFor("residential", "co_applicant").flatMap((s) => s.questions).some((q) => q.name === "occupants")).toBe(false);
    expect(sectionsFor("commercial", "applicant").flatMap((s) => s.questions).some((q) => q.name === "business_name")).toBe(true);
  });
  it("never asks for a Social Security number or date of birth", () => {
    const names = ["residential", "commercial"].flatMap((k) => sectionsFor(k as "residential", "applicant")).flatMap((s) => s.questions.map((q) => `${q.name} ${q.label}`.toLowerCase()));
    expect(names.some((n) => /ssn|social security|birth/.test(n))).toBe(false);
  });
});
