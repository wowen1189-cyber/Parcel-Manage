import { describe, expect, it } from "vitest";
import { aging, toCsv } from "@/lib/report-math";

describe("aged receivables", () => {
  const charges = [
    { amount_cents: 100000, due_date: "2026-08-01" },
    { amount_cents: 100000, due_date: "2026-09-01" },
    { amount_cents: 100000, due_date: "2026-10-01" },
    { amount_cents: 100000, due_date: "2026-11-01" },
    { amount_cents: 100000, due_date: "2026-12-01" },
  ];
  it("applies payments to the oldest charges and buckets the rest", () => {
    expect(aging(charges, 150000, "2026-11-01")).toEqual({ current: 100000, d30: 100000, d60: 50000, d90: 0, total: 250000 });
  });
  it("ignores charges not yet due and shows over-90 balances", () => {
    expect(aging(charges, 0, "2026-11-15").d90).toBe(100000);
    expect(aging(charges, 0, "2026-11-15").total).toBe(400000);
  });
});

describe("CSV", () => {
  it("writes money as dollars and quotes commas", () => {
    expect(toCsv([{ key: "n", label: "Name" }, { key: "a", label: "Amount", kind: "money" }], [{ n: "Smith, Pat", a: 123456 }])).toBe('Name,Amount\n"Smith, Pat",1234.56');
  });
});
