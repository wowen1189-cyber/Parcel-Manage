import { describe, expect, it } from "vitest";
import { MANAGEMENT_AGREEMENT } from "@/lib/documents/management-agreement";
import { documentToText, usedFields } from "@/lib/documents/text";
import { agreementEndDate, agreementTermsFromForm, DEFAULT_AGREEMENT_TERMS, fillAgreement, readAgreementDefaults, type AgreementInput } from "@/lib/management-agreement";
import { DEFAULT_MANAGEMENT_FEE, effectiveFee } from "@/lib/management-fees";

const fee = { ...DEFAULT_MANAGEMENT_FEE, percent: 5, leasingFee: "none" as const };
const input: AgreementInput = {
  createdOn: "2026-11-01",
  startDate: "2026-12-01",
  endDate: agreementEndDate("2026-12-01", 3),
  terms: DEFAULT_AGREEMENT_TERMS,
  owner: { name: "Sample Holdings LLC", mailing_address: "1 Sample Way, Eustis, FL 32726", email: "owner@example.com" },
  signer: { name: "Jordan Sample", title: "Manager" },
  company: { name: "Sample PM", legal_name: null, address: "2 Office St, Eustis, FL 32726", office_email: "office@example.com", broker_license: "CQ0000000" },
  properties: [
    { name: "Oak House", address: "5 Oak Ln, Eustis, FL 32726", fee },
    { name: "Pine Flats", address: "7 Pine St, Eustis, FL 32726", fee },
  ],
};

describe("management agreement", () => {
  it("runs from the start date to the day before the anniversary", () => {
    expect(agreementEndDate("2026-12-01", 3)).toBe("2029-11-30");
    expect(agreementEndDate("2027-01-01", 1)).toBe("2027-12-31");
  });
  it("fills every merge field the agreement uses", () => {
    const { values, conditions, missing } = fillAgreement(input);
    expect(missing).toEqual([]);
    const blank = usedFields(MANAGEMENT_AGREEMENT, conditions).filter((k) => !values[k]);
    expect(blank).toEqual([]);
    expect(values.management_fee).toBe("5% of gross income collected");
    expect(values.leasing_fee).toBe("none");
    expect(values.agent_license).toContain("CQ0000000");
    expect(values.term_years).toBe("three years");
    expect(values.distribution_day).toBe("1st");
  });
  it("lists each property's fee when they differ", () => {
    const mixed = { ...input, properties: [input.properties[0], { ...input.properties[1], fee: { ...fee, leasingFee: "flat" as const, leasingFlatCents: 50_000 } }] };
    expect(fillAgreement(mixed).values.leasing_fee).toBe("Oak House: none; Pine Flats: $500");
  });
  it("leaves out powers the owner didn't grant", () => {
    const { values, conditions } = fillAgreement({ ...input, terms: { ...DEFAULT_AGREEMENT_TERMS, evictions: false, autoRenew: false } });
    const text = JSON.stringify(documentToText(MANAGEMENT_AGREEMENT, values, conditions));
    expect(text).not.toContain("NOTICES AND EVICTIONS");
    expect(text).not.toContain("renews automatically");
    expect(text).toContain("third business day"); // trust account rule, 475.25(1)(k)
    expect(text).toContain("83.49(7)"); // deposits move when management ends
  });
  it("says what's missing before it can be sent", () => {
    expect(fillAgreement({ ...input, owner: { ...input.owner, email: null }, signer: { name: null, title: null }, properties: [] }).missing).toEqual(["at least one property", "the owner's e-mail", "who signs for the owner"]);
  });
  it("reads the terms form", () => {
    const { terms } = agreementTermsFromForm({ term_years: "3", notice_days: "60", approval_limit: "$750", distribution_day: "10", reserve: "1,000", disbursement_fee: "130", w9_fee: "50", release_months: "6", inspection_frequency: "quarterly", residential_liability: "100,000", commercial_liability: "1,000,000", owner_liability: "1,000,000", eviction_estimate: "$1,000 to $2,500", power_leasing: "on", auto_renew: "on" });
    expect(terms).toMatchObject({ approvalLimitCents: 75_000, reserveCents: 100_000, leasing: true, evictions: false, autoRenew: true });
    expect(agreementTermsFromForm({ term_years: "9" }).error).toMatch(/1 to 5 years/);
  });
  it("uses each property's own fee over the owner's and the company's", () => {
    const company = { ...DEFAULT_MANAGEMENT_FEE, percent: 10 };
    const owner = { ...company, percent: 8, leasingFee: "flat", leasingFlatCents: 75_000 };
    const own = { ...company, percent: 6, leasingFee: "none", renewalFee: "flat", renewalFeeCents: 10_000 };
    const props = [
      { name: "Oak House", address: "5 Oak Ln", fee: effectiveFee(own, owner, company).fee },
      { name: "Pine Flats", address: "7 Pine St", fee: effectiveFee(null, owner, company).fee },
      { name: "Elm Court", address: "9 Elm Ct", fee: effectiveFee(null, null, company).fee },
    ];
    const { values } = fillAgreement({ ...input, properties: props });
    expect(values.management_fee).toBe("Oak House: 6% of gross income collected; Pine Flats: 8% of gross income collected; Elm Court: 10% of gross income collected");
    expect(values.leasing_fee).toContain("Pine Flats: $750");
    expect(values.renewal_fee).toContain("Oak House: $100");
  });
  it("starts new agreements from the company's own default terms", () => {
    expect(readAgreementDefaults({})).toEqual(DEFAULT_AGREEMENT_TERMS);
    const mine = readAgreementDefaults({ agreementDefaults: { termYears: 1, approvalLimitCents: 25_000, disbursementFeeCents: 0 } });
    expect(mine).toMatchObject({ termYears: 1, approvalLimitCents: 25_000, disbursementFeeCents: 0, noticeDays: 60 });
    expect(readAgreementDefaults({ agreementDefaults: { termYears: 99 } })).toEqual(DEFAULT_AGREEMENT_TERMS);
  });
});
