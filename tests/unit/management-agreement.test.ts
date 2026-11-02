import { describe, expect, it } from "vitest";
import { MANAGEMENT_AGREEMENT } from "@/lib/documents/management-agreement";
import { documentToText, usedFields } from "@/lib/documents/text";
import { agreementEndDate, agreementTermsFromForm, DEFAULT_AGREEMENT_TERMS, fillAgreement, type AgreementInput } from "@/lib/management-agreement";
import { DEFAULT_MANAGEMENT_FEE } from "@/lib/management-fees";

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
    expect(values.management_fee).toBe("5% of rent collected");
    expect(values.leasing_fee).toBe("none");
    expect(values.agent_license).toContain("CQ0000000");
    expect(values.term_years).toBe("three years");
    expect(values.distribution_day).toBe("10th");
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
});
