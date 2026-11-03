import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_RULES } from "@/lib/business-rules";
import { csvDate, daysBetween, money } from "@/lib/format";
import { toCsv } from "@/lib/csv";
import { companyLateFeeText, lateFeeText, leaseLateFeeFields, leaseTiming } from "@/lib/leases";
import { vendorCompliance } from "@/lib/vendors";

const TODAY = "2026-11-01";

describe("lateFeeText", () => {
  it("uses the lease's own terms when it has them", () => {
    expect(lateFeeText({ late_fee_grace_days: 3, late_fee_flat_cents: 7500, late_fee_pct: null }, DEFAULT_BUSINESS_RULES)).toEqual({
      text: "$75.00 if unpaid after the 3rd",
      source: "lease",
    });
    expect(lateFeeText({ late_fee_grace_days: 5, late_fee_flat_cents: null, late_fee_pct: "10.00" }, DEFAULT_BUSINESS_RULES).text).toBe(
      "10% of rent if unpaid after the 5th",
    );
  });

  it("falls back to the company's business rules", () => {
    expect(lateFeeText({ late_fee_grace_days: null, late_fee_flat_cents: null, late_fee_pct: null }, DEFAULT_BUSINESS_RULES)).toEqual({
      text: "$75.00 on the 4th, then $10.00 a day up to $250.00",
      source: "company",
    });
  });

  it("fills the lease's late fee blanks from the company rule, so the lease says what billing charges", () => {
    expect(leaseLateFeeFields(DEFAULT_BUSINESS_RULES)).toEqual({
      rent_late_after_day: "3rd",
      late_fee_rule: "$75.00 on the 4th",
      daily_late_fee_start_day: "4th",
      daily_late_fee: "$10.00 a day, up to $250.00 in daily late fees a month",
    });
    const noDaily = { ...DEFAULT_BUSINESS_RULES, rent: { ...DEFAULT_BUSINESS_RULES.rent, lateFeeDailyCents: 0 } };
    expect(leaseLateFeeFields(noDaily).daily_late_fee).toBe("$0.00");
    expect(companyLateFeeText(noDaily)).toBe("$75.00 on the 4th");
  });
});

describe("leaseTiming", () => {
  it("labels month-to-month, ending soon, past end and notice", () => {
    expect(leaseTiming({ status: "active", end_date: null, move_out_on: null }, TODAY).label).toBe("Month-to-month");
    expect(leaseTiming({ status: "active", end_date: "2026-12-31", move_out_on: null }, TODAY)).toMatchObject({ label: "Ends in 60 days", daysLeft: 60 });
    expect(leaseTiming({ status: "active", end_date: "2027-06-30", move_out_on: null }, TODAY).label).toBe("Active");
    expect(leaseTiming({ status: "active", end_date: "2026-10-31", move_out_on: null }, TODAY).tone).toBe("danger");
    expect(leaseTiming({ status: "notice", end_date: "2026-11-30", move_out_on: "2026-11-30" }, TODAY)).toMatchObject({ label: "On notice", daysLeft: 29 });
  });
});

describe("vendorCompliance", () => {
  const base = { trade: "Plumbing", w9_on_file: true, coi_expires_on: "2027-06-01", workers_comp_expires_on: null, dispatch_override: false };

  it("clears an on-site vendor with a W-9 and current insurance", () => {
    expect(vendorCompliance(base, TODAY)).toEqual({ status: "ok", issues: [], canDispatch: true });
  });

  it("blocks dispatch when the W-9 or insurance is missing or expired", () => {
    expect(vendorCompliance({ ...base, w9_on_file: false, coi_expires_on: null }, TODAY)).toEqual({
      status: "blocked",
      issues: ["No W-9 on file", "No insurance certificate"],
      canDispatch: false,
    });
    expect(vendorCompliance({ ...base, coi_expires_on: "2026-10-31" }, TODAY).issues).toEqual(["Insurance expired"]);
  });

  it("warns 30 days ahead but still allows dispatch", () => {
    expect(vendorCompliance({ ...base, coi_expires_on: "2026-11-15" }, TODAY)).toEqual({ status: "expiring", issues: ["Insurance ends in 14 days"], canDispatch: true });
  });

  it("lets an admin override, and exempts vendors who never come on site", () => {
    expect(vendorCompliance({ ...base, w9_on_file: false, dispatch_override: true }, TODAY).canDispatch).toBe(true);
    expect(vendorCompliance({ ...base, trade: "Utility", w9_on_file: false, coi_expires_on: null }, TODAY).status).toBe("not_required");
    expect(vendorCompliance({ ...base, trade: "Other", w9_on_file: false }, TODAY).status).toBe("blocked");
  });
});

describe("formatting and CSV", () => {
  it("formats money and dates", () => {
    expect(money(138050)).toBe("$1,380.50");
    expect(money(-1050)).toBe("-$10.50");
    expect(money(null)).toBe("—");
    expect(csvDate("2026-05-01")).toBe("05/01/2026");
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("quotes commas and stops spreadsheet formulas", () => {
    expect(toCsv(["a", "b"], [["x, y", "=HYPERLINK(1)"], ["-10.50", 'say "hi"']])).toBe('a,b\r\n"x, y",\'=HYPERLINK(1)\r\n-10.50,"say ""hi"""\r\n');
  });
});

describe("lateFeeText with daily fees", () => {
  it("describes a flat fee plus a capped daily fee, and a percent of all charges", () => {
    expect(lateFeeText({ late_fee_grace_days: 3, late_fee_flat_cents: 7500, late_fee_pct: null, late_fee_daily_cents: 1000, late_fee_daily_max_cents: 25000 }, DEFAULT_BUSINESS_RULES).text).toBe(
      "$75.00 if unpaid after the 3rd, then $10.00 a day up to $250.00",
    );
    expect(lateFeeText({ late_fee_grace_days: 5, late_fee_flat_cents: null, late_fee_pct: 10, late_fee_basis: "all_charges" }, DEFAULT_BUSINESS_RULES).text).toBe(
      "10% of all charges if unpaid after the 5th",
    );
  });
});
