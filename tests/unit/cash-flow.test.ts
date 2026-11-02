import { describe, expect, it } from "vitest";
import { cashFlow } from "@/lib/report-math";

const cash = (debit: number, credit = 0) => ({ account: "1000 Operating cash", cash: true, debit, credit });
const other = (account: string, debit: number, credit = 0) => ({ account, cash: false, debit, credit });

describe("cash flow", () => {
  it("credits cash in to income and cash out to expenses", () => {
    const rows = cashFlow([
      [cash(150_000), other("1200 Receivable", 0, 150_000)],
      [cash(0, 20_000), other("5000 Repairs", 20_000)],
    ]);
    expect(rows).toEqual([
      { account: "1200 Receivable", cashIn: 150_000, cashOut: 0, net: 150_000 },
      { account: "5000 Repairs", cashIn: 0, cashOut: 20_000, net: -20_000 },
    ]);
  });
  it("splits one payment across several accounts and ignores entries without cash", () => {
    const rows = cashFlow([
      [cash(100_000), other("4000 Rent", 0, 75_000), other("4100 Late fees", 0, 25_000)],
      [other("1200 Receivable", 150_000), other("4000 Rent", 0, 150_000)],
    ]);
    expect(rows.find((r) => r.account === "4000 Rent")?.cashIn).toBe(75_000);
    expect(rows.find((r) => r.account === "4100 Late fees")?.cashIn).toBe(25_000);
    expect(rows.reduce((s, r) => s + r.net, 0)).toBe(100_000);
  });
  it("nets a transfer between two cash accounts to nothing", () => {
    expect(cashFlow([[cash(5_000), { account: "1010 Trust cash", cash: true, debit: 0, credit: 5_000 }]])).toEqual([]);
  });
});
