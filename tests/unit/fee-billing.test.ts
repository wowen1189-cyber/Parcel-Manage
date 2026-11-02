import { describe, expect, it } from "vitest";
import { approvalEntries, canBill, feeLines, feeTotal, grossCollected, paymentEntries, type BookEntry } from "@/lib/fee-billing";
import { DEFAULT_MANAGEMENT_FEE, type ManagementFee } from "@/lib/management-fees";
import { ownerMoneyLines } from "@/lib/owner-money";

const P = "prop-1";
const line = (account: string, type: string, debit: number, credit: number, property_id: string | null = P) => ({ account, type, debit, credit, property_id });
const fivePct: ManagementFee = { ...DEFAULT_MANAGEMENT_FEE, percent: 5, leasingFee: "flat", leasingFlatCents: 50000, renewalFee: "flat", renewalFeeCents: 25000 };

describe("gross income collected", () => {
  const entries: BookEntry[] = [
    // Rent and a utility reimbursement paid by a tenant.
    { id: "p1", source: "payment", reversal_of: null, lines: [line("1000", "asset", 120000, 0), line("1100", "asset", 0, 120000)] },
    { id: "p2", source: "payment", reversal_of: null, lines: [line("1000", "asset", 8500, 0), line("1100", "asset", 0, 8500)] },
    // A security deposit lands in trust: not income.
    { id: "d1", source: "payment", reversal_of: null, lines: [line("1010", "asset", 150000, 0), line("2100", "liability", 0, 150000)] },
    // Laundry money deposited and booked straight to income.
    { id: "m1", source: "manual", reversal_of: null, lines: [line("1000", "asset", 4000, 0), line("4090", "income", 0, 4000)] },
    // Charges, bills, owner money and fee entries don't count.
    { id: "c1", source: "charge", reversal_of: null, lines: [line("1100", "asset", 120000, 0), line("4000", "income", 0, 120000)] },
    { id: "o1", source: "owner_money", reversal_of: null, lines: [line("1000", "asset", 500000, 0), line("3000", "equity", 0, 500000)] },
    // A returned payment.
    { id: "r1", source: "reversal", reversal_of: "p2", lines: [line("1000", "asset", 0, 8500), line("1100", "asset", 8500, 0)] },
  ];

  it("counts all tenant money and other cash income, not deposits, charges or owner money, less returned payments", () => {
    expect(grossCollected(entries, new Map([["p2", "payment"]])).get(P)).toBe(120000 + 4000);
  });

  it("counts a deposit applied to what the tenant owed", () => {
    const applied: BookEntry = { id: "a1", source: "deposit", reversal_of: null, lines: [line("2100", "liability", 30000, 0), line("1100", "asset", 0, 30000), line("1000", "asset", 30000, 0), line("1010", "asset", 0, 30000)] };
    expect(grossCollected([applied]).get(P)).toBe(30000);
  });
});

describe("fee bills", () => {
  const lines = feeLines([{ id: P, name: "Test Tower", fee: fivePct, grossCents: 124000, occupied: 1, newLeaseRents: [130000], renewalRents: [140000] }]);

  it("bills 5% of gross income plus leasing and renewal fees", () => {
    expect(lines.map((l) => [l.kind, l.amountCents])).toEqual([
      ["management", 6200],
      ["leasing", 50000],
      ["renewal", 25000],
    ]);
    expect(feeTotal(lines)).toBe(81200);
  });

  it("posts both sets of books, balanced, on approval and payment", () => {
    const sum = (ls: { debit?: number; credit?: number }[]) => [ls.reduce((s, l) => s + (l.debit ?? 0), 0), ls.reduce((s, l) => s + (l.credit ?? 0), 0)];
    const a = approvalEntries(lines);
    expect(sum(a.owner)).toEqual([81200, 81200]);
    expect(sum(a.manager)).toEqual([81200, 81200]);
    expect(a.owner.filter((l) => l.account === "2050").length).toBe(3);
    expect(a.manager.find((l) => l.account === "4120")?.credit).toBe(25000);
    const pay = paymentEntries(lines);
    expect(pay.owner).toEqual([
      { account: "2050", debit: 81200, property_id: P },
      { account: "1000", credit: 81200, property_id: P },
    ]);
    expect(pay.manager).toEqual([
      { account: "1000", debit: 81200 },
      { account: "1150", credit: 81200 },
    ]);
  });

  it("only bills a month that has ended", () => {
    expect(canBill("2026-10", "2026-11-02")).toBe(true);
    expect(canBill("2026-11", "2026-11-02")).toBe(false);
  });
});

describe("owner money", () => {
  it("records draws, contributions, outside-paid expenses and loan payments as balanced entries", () => {
    expect(ownerMoneyLines({ kind: "draw", amountCents: 100000 }).lines).toEqual([
      { account: "3100", debit: 100000 },
      { account: "1000", credit: 100000 },
    ]);
    expect(ownerMoneyLines({ kind: "contribution", amountCents: 5000 }).lines?.[1]).toEqual({ account: "3000", credit: 5000 });
    expect(ownerMoneyLines({ kind: "paid_personally", amountCents: 7500, expenseAccount: "5000", propertyId: P }).lines).toEqual([
      { account: "5000", debit: 7500, property_id: P },
      { account: "3000", credit: 7500, property_id: P },
    ]);
    expect(ownerMoneyLines({ kind: "loan_payment", amountCents: 0, interestCents: 60000, principalCents: 40000 }).lines).toEqual([
      { account: "5500", debit: 60000 },
      { account: "2500", debit: 40000 },
      { account: "1000", credit: 100000 },
    ]);
  });

  it("refuses empty amounts and a missing expense", () => {
    expect(ownerMoneyLines({ kind: "draw", amountCents: 0 }).error).toBeTruthy();
    expect(ownerMoneyLines({ kind: "paid_personally", amountCents: 100 }).error).toBe("Choose the expense.");
    expect(ownerMoneyLines({ kind: "loan_payment", amountCents: 0 }).error).toBeTruthy();
  });
});
