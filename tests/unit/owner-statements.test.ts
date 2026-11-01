import { describe, expect, it } from "vitest";
import { distributable, monthEnd, payeesFor, previousMonth, splitByOwnership } from "@/lib/owner-statements";

describe("owner statements", () => {
  it("distributes cash after unpaid bills and the reserve, never below zero", () => {
    expect(distributable(1_000_000, 150_000, 250_000)).toBe(600_000);
    expect(distributable(100_000, 150_000, 0)).toBe(0);
  });
  it("splits by ownership to the cent", () => {
    const rows = splitByOwnership(1_000_001, [
      { contactId: "w", name: "Wesley", pct: 35 },
      { contactId: "d", name: "Daniel", pct: 32.5 },
      { contactId: "r", name: "Rick", pct: 32.5 },
    ]);
    expect(rows.map((r) => r.amountCents)).toEqual([350_001, 325_000, 325_000]);
    expect(rows.reduce((s, r) => s + r.amountCents, 0)).toBe(1_000_001);
  });
  it("pays the partners when every property has the same partners, otherwise the owner", () => {
    const partners = [{ contactId: "a", name: "A", pct: 60 }, { contactId: "b", name: "B", pct: 40 }];
    expect(payeesFor("Tower LLC", [{ partners }])).toEqual([{ contactId: "a", name: "A", pct: 60 }, { contactId: "b", name: "B", pct: 40 }]);
    expect(payeesFor("Homes LLC", [{ partners }, { partners: [] }])).toEqual([{ contactId: null, name: "Homes LLC", pct: 100 }]);
    expect(payeesFor("Homes LLC", [{ partners: [] }])).toEqual([{ contactId: null, name: "Homes LLC", pct: 100 }]);
  });
  it("knows month bounds", () => {
    expect(monthEnd("2028-02")).toBe("2028-02-29");
    expect(previousMonth("2027-01-15")).toBe("2026-12");
  });
});
