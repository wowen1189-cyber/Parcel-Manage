import { describe, expect, it } from "vitest";
import { billable, SECTIONS, sortAccounts, TAX_LINES, TYPE_DIGIT, validAccountNumber } from "@/lib/accounts";
import { readFileSync } from "node:fs";

describe("chart of accounts", () => {
  it("lets bills use expenses and capital improvements only", () => {
    expect(billable({ type: "expense", section: "Utilities" })).toBe(true);
    expect(billable({ type: "asset", section: "Capital improvements" })).toBe(true);
    expect(billable({ type: "asset", section: "Cash" })).toBe(false);
    expect(billable({ type: "income", section: "Rental income" })).toBe(false);
  });

  it("sorts by kind, then heading, then number", () => {
    const sorted = sortAccounts([
      { type: "expense" as const, section: "Utilities", number: "5210" },
      { type: "income" as const, section: "Rental income", number: "4000" },
      { type: "expense" as const, section: "Repairs and maintenance", number: "5050" },
      { type: "expense" as const, section: "Repairs and maintenance", number: "5000" },
    ]);
    expect(sorted.map((a) => a.number)).toEqual(["4000", "5000", "5050", "5210"]);
  });

  it("checks account numbers", () => {
    expect(validAccountNumber("5047")).toBe(true);
    expect(validAccountNumber("504")).toBe(false);
    expect(validAccountNumber("50a7")).toBe(false);
  });

  it("seeds every account with a known heading, a matching number range and a known Schedule E line", () => {
    const sql = readFileSync("supabase/migrations/0062_chart_of_accounts.sql", "utf8");
    const rows = [...sql.matchAll(/\('(\d{4})', '([^']+)', '(\w+)', (?:true|false), '([^']+)', (null|'[^']+'), (?:true|false)\)/g)];
    expect(rows.length).toBeGreaterThan(100);
    const numbers = new Set<string>();
    for (const [, number, , type, section, taxLine] of rows) {
      const t = type as keyof typeof SECTIONS;
      expect(numbers.has(number), number).toBe(false);
      numbers.add(number);
      expect(number[0], number).toBe(TYPE_DIGIT[t]);
      expect(SECTIONS[t], number).toContain(section);
      if (taxLine !== "null") expect(TAX_LINES, number).toContain(taxLine.slice(1, -1));
    }
    // Accounts the app posts to on its own must still be there.
    for (const n of ["1000", "1010", "1100", "1150", "1200", "2000", "2050", "2100", "2200", "2500", "3000", "3100", "3900", "4000", "4010", "4020", "4030", "4040", "4050", "4060", "4090", "4100", "4110", "4120", "5000", "5100", "5110", "5500"]) expect(numbers.has(n), n).toBe(true);
  });
});
