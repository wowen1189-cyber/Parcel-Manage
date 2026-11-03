import { describe, expect, it } from "vitest";
import { cashFlow, cashKind, detailRows, itemize, type DetailLine } from "@/lib/owner-statement-detail";

const line = (o: Partial<DetailLine> & Pick<DetailLine, "entryId" | "account">): DetailLine => ({
  date: "2026-10-05",
  source: "manual",
  accountName: "Account",
  type: "asset",
  debit: 0,
  credit: 0,
  propertyId: null,
  unit: null,
  memo: "",
  ...o,
});

// One month for a made-up owner: rent in, a plumber's bill paid, the fee bill paid, a distribution, a bank fee.
const lines: DetailLine[] = [
  line({ entryId: "rent", account: "1000", debit: 150000 }),
  line({ entryId: "rent", account: "4000", accountName: "Rent", type: "income", credit: 150000, propertyId: "p1", unit: "Unit 1", memo: "ZZ Tenant October rent" }),
  line({ entryId: "plumb", date: "2026-10-12", source: "bill", account: "5200", accountName: "Repairs", type: "expense", debit: 22500, propertyId: "p1", memo: "Kitchen leak", payee: "ZZ Plumbing" }),
  line({ entryId: "plumb", date: "2026-10-12", source: "bill", account: "1000", credit: 22500 }),
  line({ entryId: "fee", date: "2026-10-31", source: "fee", account: "5100", accountName: "Management fees", type: "expense", debit: 7500, propertyId: "p1", memo: "October management fee" }),
  line({ entryId: "fee", date: "2026-10-31", source: "fee", account: "2050", type: "liability", credit: 7500 }),
  line({ entryId: "feepay", date: "2026-10-31", source: "fee_payment", account: "2050", type: "liability", debit: 7500 }),
  line({ entryId: "feepay", date: "2026-10-31", source: "fee_payment", account: "1000", credit: 7500 }),
  line({ entryId: "dist", date: "2026-10-31", source: "distribution", account: "3100", type: "equity", debit: 100000 }),
  line({ entryId: "dist", date: "2026-10-31", source: "distribution", account: "1000", credit: 100000 }),
  line({ entryId: "bankfee", date: "2026-10-20", account: "5900", accountName: "Bank fees", type: "expense", debit: 1500, memo: "Monthly service fee" }),
  line({ entryId: "bankfee", date: "2026-10-20", account: "1000", credit: 1500 }),
];

describe("itemized owner statement", () => {
  it("lists each income and expense line by property, with the vendor, and owner-level lines last", () => {
    const g = itemize(lines, [{ id: "p1", name: "ZZ Duplex" }, { id: "p2", name: "ZZ Empty Lot" }]);
    expect(g.map((x) => x.name)).toEqual(["ZZ Duplex", "ZZ Empty Lot", "Not tied to a property"]);
    expect(g[0].income).toEqual([{ date: "2026-10-05", account: "4000 Rent", description: "ZZ Tenant October rent", unit: "Unit 1", amountCents: 150000 }]);
    expect(g[0].expenses.map((e) => e.description)).toEqual(["ZZ Plumbing: Kitchen leak", "October management fee"]);
    expect([g[0].incomeCents, g[0].expensesCents, g[0].netCents]).toEqual([150000, 30000, 120000]);
    expect(g[1]).toMatchObject({ incomeCents: 0, expensesCents: 0 });
    expect(g[2].expenses[0]).toMatchObject({ description: "Monthly service fee", amountCents: 1500 });
  });

  it("adds fees the fee bill hasn't posted yet, so totals match the statement", () => {
    const g = itemize([], [{ id: "p1", name: "ZZ Duplex" }], [{ propertyId: "p1", label: "Management fee, ZZ Duplex", amountCents: 7500 }], "2026-10-31");
    expect(g[0].expenses).toEqual([{ date: "2026-10-31", account: "Fees", description: "Management fee, ZZ Duplex (on this month's fee bill)", unit: null, amountCents: 7500 }]);
  });

  it("walks cash from beginning to ending, by kind, and checks it ties", () => {
    const c = cashFlow(lines, 50000, 50000 + 150000 - 22500 - 7500 - 100000 - 1500);
    expect(c.rows.map((r) => [r.kind, r.inCents, r.outCents])).toEqual([
      ["collected", 150000, 0],
      ["bills", 0, 24000],
      ["fees", 0, 7500],
      ["distributions", 0, 100000],
    ]);
    expect(c).toMatchObject({ inCents: 150000, outCents: 131500, tiesToBooks: true });
    expect(cashFlow(lines, 50000, 1).tiesToBooks).toBe(false);
  });

  it("sorts cash movements by what's on the other side", () => {
    expect(cashKind([line({ entryId: "x", account: "1000", debit: 1 }), line({ entryId: "x", account: "3000", type: "equity", credit: 1 })], "owner_money")).toBe("contributions");
    expect(cashKind([line({ entryId: "x", account: "1000", debit: 1 }), line({ entryId: "x", account: "1100", credit: 1 })], "payment")).toBe("collected");
    expect(cashKind([line({ entryId: "x", account: "1000", credit: 1 }), line({ entryId: "x", account: "1010", debit: 1 })], "manual")).toBe("other");
  });

  it("prints as lines for the PDF", () => {
    const rows = detailRows({ groups: itemize(lines, [{ id: "p1", name: "ZZ Duplex" }]), cash: cashFlow(lines, 0, 18500) }, (c) => `$${(c / 100).toFixed(2)}`);
    expect(rows).toContain("Beginning cash: $0.00");
    expect(rows).toContain("  Expense 2026-10-12: ZZ Plumbing: Kitchen leak $225.00");
  });
});
