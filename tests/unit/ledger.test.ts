import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_RULES } from "@/lib/business-rules";
import { DEFAULT_COMMERCIAL_TERMS } from "@/lib/commercial-terms";
import { buildLedger, endOfMonth, lateFeeAmount, lateFeePolicy, leaseBillsInMonth, recurringForMonth, rentForMonth } from "@/lib/ledger";

const noTerms = { late_fee_grace_days: null, late_fee_flat_cents: null, late_fee_pct: null, late_fee_basis: null, late_fee_daily_cents: null, late_fee_daily_max_cents: null };

describe("late fee policy", () => {
  it("uses the company rule ($50 on the 6th) when the lease has no terms of its own", () => {
    const p = lateFeePolicy(noTerms, DEFAULT_BUSINESS_RULES, null)!;
    expect(p).toMatchObject({ postsOnDay: 6, flatCents: 5000 });
    expect(lateFeeAmount(p, 150000, 150000)).toBe(5000);
  });
  it("uses the lease's own terms: late after 3 days, 10% of rent, then $10 a day up to $100", () => {
    const p = lateFeePolicy({ ...noTerms, late_fee_grace_days: 3, late_fee_pct: 10, late_fee_basis: "rent", late_fee_daily_cents: 1000, late_fee_daily_max_cents: 10000 }, DEFAULT_BUSINESS_RULES, null)!;
    expect(p).toMatchObject({ postsOnDay: 5, percent: 10, dailyCents: 1000, dailyMaxCents: 10000 });
    expect(lateFeeAmount(p, 150000, 175000)).toBe(15000);
  });
  it("uses commercial terms: 10% of the late amount after the 6th", () => {
    const p = lateFeePolicy(noTerms, DEFAULT_BUSINESS_RULES, DEFAULT_COMMERCIAL_TERMS)!;
    expect(p).toMatchObject({ postsOnDay: 7, percent: 10, basis: "balance" });
    expect(lateFeeAmount(p, 100000, 120986)).toBe(12099);
  });
});

describe("monthly billing", () => {
  it("applies a scheduled rent increase from its start", () => {
    const l = { rent_cents: 150000, next_rent_increase_on: "2027-06-01", next_rent_cents: 154500 };
    expect(rentForMonth(l, "2027-05-01")).toBe(150000);
    expect(rentForMonth(l, "2027-06-01")).toBe(154500);
  });
  it("bills active leases that have started, and stops after move-out", () => {
    const l = { start_date: "2027-01-15", end_date: "2027-12-31", move_out_on: null, status: "active" };
    expect(leaseBillsInMonth(l, "2026-12-01")).toBe(false);
    expect(leaseBillsInMonth(l, "2027-01-01")).toBe(true);
    expect(leaseBillsInMonth({ ...l, status: "notice", move_out_on: "2027-03-31" }, "2027-04-01")).toBe(false);
    expect(leaseBillsInMonth({ ...l, status: "draft" }, "2027-02-01")).toBe(false);
  });
  it("includes recurring charges active that month", () => {
    const cs = [{ id: "a", starts_on: null, ends_on: null }, { id: "b", starts_on: "2027-03-01", ends_on: null }, { id: "c", starts_on: null, ends_on: "2027-01-31" }];
    expect(recurringForMonth(cs, "2027-02-01").map((c) => c.id)).toEqual(["a"]);
    expect(endOfMonth("2028-02-01")).toBe("2028-02-29");
  });
});

describe("tenant ledger", () => {
  it("runs a balance through the opening balance, charges, payments and a returned payment", () => {
    const { rows, balanceCents } = buildLedger(
      [{ id: "c1", charge_type: "rent", description: "Rent", amount_cents: 150000, due_date: "2027-01-01", created_at: "" }],
      [
        { id: "p1", method: "check", amount_cents: 100000, received_on: "2027-01-03", status: "returned", purpose: "rent", reference: "101", returned_on: "2027-01-08", created_at: "2027-01-03T10:00:00Z" },
        { id: "p2", method: "check", amount_cents: 150000, received_on: "2027-01-03", status: "succeeded", purpose: "deposit", reference: null, returned_on: null, created_at: "" },
      ],
      { cents: 2500, asOf: "2026-11-01" },
    );
    expect(rows.map((r) => [r.kind, r.balanceCents])).toEqual([["opening", 2500], ["charge", 152500], ["payment", 52500], ["returned", 152500]]);
    expect(balanceCents).toBe(152500);
  });
  it("drops the carried-over balance once it's posted as a charge", () => {
    const { balanceCents } = buildLedger([{ id: "o", charge_type: "opening_balance", description: "Opening", amount_cents: 2500, due_date: "2026-11-01", created_at: "" }], [], { cents: 2500, asOf: "2026-11-01" });
    expect(balanceCents).toBe(2500);
  });
});
