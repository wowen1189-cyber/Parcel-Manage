import { describe, expect, it } from "vitest";
import { COMMERCIAL_LEASE } from "@/lib/documents";
import { fillCommercialLease } from "@/lib/documents/fill";
import { commercialTermsFromForm, DEFAULT_COMMERCIAL_TERMS, missingCommercialTerms, readCommercialTerms, rentSchedule } from "@/lib/commercial-terms";
import { defaultLeaseSettings } from "@/lib/property-lease-settings";

describe("rent schedule", () => {
  it("raises base rent on each anniversary, rounded to the cent", () => {
    expect(rentSchedule("2026-11-01", "2029-10-31", 100_000, 5)).toEqual([
      { from: "2026-11-01", to: "2027-10-31", monthlyCents: 100_000 },
      { from: "2027-11-01", to: "2028-10-31", monthlyCents: 105_000 },
      { from: "2028-11-01", to: "2029-10-31", monthlyCents: 110_250 },
    ]);
  });
  it("ends the last step on the lease end date for a partial year", () => {
    expect(rentSchedule("2027-01-01", "2028-06-30", 200_000, 3).at(-1)).toEqual({ from: "2028-01-01", to: "2028-06-30", monthlyCents: 206_000 });
  });
});

describe("commercial terms form", () => {
  it("reads dollars, percents and the CAM checkbox", () => {
    const { terms } = commercialTermsFromForm({ permitted_use: "Salon", annual_increase: "5%", cam_monthly: "$125", utilities_monthly: "109.86", repair_threshold: "750" });
    expect(terms).toMatchObject({ permittedUse: "Salon", annualIncreasePercent: 5, camMonthlyCents: 12_500, camFixed: false, utilitiesMonthlyCents: 10_986, repairThresholdCents: 75_000 });
  });
  it("keeps saved values for fields not on the form and explains bad input", () => {
    expect(commercialTermsFromForm({ permitted_use: "Office" }, { ...DEFAULT_COMMERCIAL_TERMS, lateFeePercent: 7 }).terms?.lateFeePercent).toBe(7);
    expect(commercialTermsFromForm({ annual_increase: "40" }).error).toMatch(/0% and 25%/);
    expect(commercialTermsFromForm({ cam_monthly: "abc" }).error).toMatch(/dollars/);
  });
  it("needs a permitted use", () => {
    expect(missingCommercialTerms(readCommercialTerms(null))).toEqual(["permitted use"]);
    expect(missingCommercialTerms(readCommercialTerms({ permittedUse: "Office" }))).toEqual([]);
  });
});

describe("filling the commercial lease", () => {
  const lease = {
    start_date: "2026-11-01",
    end_date: "2029-10-31",
    term_months: 36,
    rent_cents: 100_000,
    deposit_cents: 80_000,
    unitLabel: "B",
    unitKind: "commercial",
    sqft: 1000,
    createdAt: "2026-10-15T12:00:00Z",
    property: { name: "Sample Plaza", property_type: "commercial", address_line1: "127 Sample St", address_line2: null, city: "Eustis", state: "FL", postal_code: "32726", year_built: 1925, entityName: "Sample Holdings LLC" },
    people: [
      { role: "tenant", is_primary: true, contact: { kind: "person", first_name: "Jordan", last_name: "Sample", business_name: null, email: "jordan@example.com", mobile: "(352) 555-0123" } },
      { role: "guarantor", is_primary: false, contact: { kind: "person", first_name: "Casey", last_name: "Sample", business_name: null, email: null } },
    ],
    pets: [],
    recurring: [],
  };
  const company = { name: "Sample PM", legal_name: "Sample PM LLC", address: "1 Office St, Eustis, FL 32726", office_phone: "(352) 555-0100", office_email: "office@example.com" };
  const terms = { ...DEFAULT_COMMERCIAL_TERMS, businessName: "Sample Studio LLC", permittedUse: "Hair salon", camMonthlyCents: 0, camFixed: true };
  const settings = { ...defaultLeaseSettings("commercial", 3), depositBankName: "Sample Bank", depositBankAddress: "100 Bank St", legalDescription: "Lot 1, Block 1" };

  it("fills the summary, schedule, exhibits and guaranty", () => {
    const { values, conditions, parties } = fillCommercialLease(COMMERCIAL_LEASE, lease, company, terms, settings);
    expect(values.tenant_legal_name).toBe("Jordan Sample, dba Sample Studio LLC");
    expect(values.landlord_name).toBe("Sample Holdings LLC");
    expect(values.premises_address).toBe("127 Sample St, Unit B, Eustis, FL 32726");
    expect(values.rent_schedule).toBe("Nov 1, 2026 – Oct 31, 2027: $1,000.00; Nov 1, 2027 – Oct 31, 2028: $1,050.00; Nov 1, 2028 – Oct 31, 2029: $1,102.50");
    expect(values.cam_summary).toBe("$0.00 a month, fixed through Oct 31, 2029");
    expect(values.late_after_day).toBe("6th");
    expect(values.repair_threshold).toBe("$750.00");
    expect(values.legal_description).toBe("Lot 1, Block 1");
    expect(values.renewal_summary).toMatch(/^one \(1\) renewal term of 12 months at a 5% higher Base Rent; written notice at least 90 days/);
    expect(values.renewal_clause).toContain("increased by 5%");
    expect(conditions.has("has_guarantor")).toBe(true);
    expect(parties.guarantors).toEqual(["Casey Sample"]);
  });

  it("leaves nothing in the template without a value except true blanks", () => {
    const { values } = fillCommercialLease(COMMERCIAL_LEASE, lease, company, terms, settings);
    const used = [...JSON.stringify(COMMERCIAL_LEASE.sections).matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((m) => m[1]);
    expect(used.filter((k) => !(k in COMMERCIAL_LEASE.fields))).toEqual([]);
    expect(used.filter((k) => !values[k])).toEqual([]);
  });

  it("states the Florida rules the lease relies on", () => {
    const text = JSON.stringify(COMMERCIAL_LEASE.sections.map((s) => s.clauses.map((c) => c.blocks)));
    expect(text).toContain("three (3) days after Landlord's written notice"); // 83.20(2)
    expect(text).toContain("tenant at sufferance (Fla. Stat. 83.04)");
    expect(text).toContain("double the monthly Base Rent"); // 83.06(1)
    expect(text).toContain("RADON GAS: Radon is a naturally occurring radioactive gas"); // 404.056(5)
    expect(text).not.toMatch(/by force, if necessary/);
    expect(text).not.toMatch(/PRIOR NOTICE TO QUIT/);
  });
});
