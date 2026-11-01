import { describe, expect, it } from "vitest";
import { checkEntry, netIncome, normalBalance, trialBalanceTotals, type AccountBalance } from "@/lib/books";

const row = (number: string, type: string, debit: number, credit: number): AccountBalance => ({ account_id: number, number, name: number, type, is_trust: false, debit_cents: debit, credit_cents: credit });

describe("books", () => {
  const rows = [row("1000", "asset", 100000, 0), row("1100", "asset", 150000, 100000), row("4000", "income", 0, 150000), row("5000", "expense", 20000, 0), row("2000", "liability", 0, 20000)];
  it("shows balances in each account's normal direction", () => {
    expect(normalBalance(rows[1])).toBe(50000);
    expect(normalBalance(rows[2])).toBe(150000);
  });
  it("checks the trial balance and net income", () => {
    expect(trialBalanceTotals(rows)).toEqual({ debit: 270000, credit: 270000, balanced: true });
    expect(netIncome(rows)).toBe(130000);
  });
  it("only posts balanced manual entries", () => {
    expect(checkEntry([{ account: "5000", debit: 1000, credit: 0 }, { account: "1000", debit: 0, credit: 1000 }])).toBeNull();
    expect(checkEntry([{ account: "5000", debit: 1000, credit: 0 }, { account: "1000", debit: 0, credit: 900 }])).toMatch(/must match/);
    expect(checkEntry([{ account: "5000", debit: 1000, credit: 1000 }, { account: "1000", debit: 0, credit: 0 }])).toMatch(/at least two|not both/);
    expect(checkEntry([{ account: "", debit: 1000, credit: 0 }, { account: "1000", debit: 0, credit: 1000 }])).toMatch(/Choose an account/);
  });
});

import { cardFeeCents, parseStripeSignature } from "@/lib/integrations/stripe/fees";
describe("online payments", () => {
  it("adds the card fee only to card payments, rounded to the cent", () => {
    expect(cardFeeCents(150000, 3)).toBe(4500);
    expect(cardFeeCents(123456, 3)).toBe(3704);
  });
  it("reads Stripe's signature header", () => {
    expect(parseStripeSignature("t=1700000000,v1=abc,v1=def,v0=zzz")).toEqual({ t: 1700000000, v1: ["abc", "def"] });
    expect(parseStripeSignature(null)).toBeNull();
  });
});

import { nextBillDate } from "@/lib/bills";
describe("recurring bills", () => {
  it("steps by month, quarter or year, keeping the day where it can", () => {
    expect(nextBillDate("2026-11-15", "monthly")).toBe("2026-12-15");
    expect(nextBillDate("2027-01-31", "monthly")).toBe("2027-02-28");
    expect(nextBillDate("2026-11-30", "quarterly")).toBe("2027-02-28");
    expect(nextBillDate("2026-11-01", "yearly")).toBe("2027-11-01");
  });
});

import { autopayAmount, autopayDue } from "@/lib/autopay-rules";

describe("autopay", () => {
  it("runs once a month, on or after the tenant's day", () => {
    expect(autopayDue("2026-11-01", 1, null)).toBe(true);
    expect(autopayDue("2026-11-01", 3, null)).toBe(false);
    expect(autopayDue("2026-11-05", 3, "2026-10")).toBe(true);
    expect(autopayDue("2026-11-05", 3, "2026-11")).toBe(false);
  });
  it("drafts the balance up to the limit, nothing under $1", () => {
    expect(autopayAmount(125000, null)).toBe(125000);
    expect(autopayAmount(125000, 100000)).toBe(100000);
    expect(autopayAmount(50, null)).toBe(0);
    expect(autopayAmount(-500, null)).toBe(0);
  });
});
