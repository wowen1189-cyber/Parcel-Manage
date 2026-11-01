import { describe, expect, it } from "vitest";
import { fingerprint, parseBankCsv, suggestMatch } from "@/lib/bank";

describe("bank statements", () => {
  it("reads a signed amount column", () => {
    const { rows } = parseBankCsv("Date,Description,Amount\n11/03/2026,DEPOSIT CHECK 1042,\"1,525.00\"\n11/05/2026,COOL AIR LLC,-245.00\n");
    expect(rows).toEqual([
      { posted_on: "2026-11-03", description: "DEPOSIT CHECK 1042", amount_cents: 152500 },
      { posted_on: "2026-11-05", description: "COOL AIR LLC", amount_cents: -24500 },
    ]);
  });
  it("reads separate debit and credit columns and parentheses", () => {
    const { rows } = parseBankCsv("Bank of Sample statement\nPosting Date,Memo,Debit,Credit\n2026-11-03,Rent deposit,,1500.00\n2026-11-06,Plumber,(245.00),\n");
    expect(rows.map((r) => r.amount_cents)).toEqual([150000, -24500]);
  });
  it("explains a file it can't read", () => {
    expect(parseBankCsv("just,some,text\n1,2,3").error).toMatch(/date and amount/);
  });
  it("matches the same amount within 5 days, closest first, once", () => {
    const lines = [
      { id: "a", entry_date: "2026-11-01", memo: "Payment", amount_cents: 152500 },
      { id: "b", entry_date: "2026-11-04", memo: "Payment", amount_cents: 152500 },
      { id: "c", entry_date: "2026-10-01", memo: "Old", amount_cents: 152500 },
    ];
    const tx = { posted_on: "2026-11-03", description: "DEPOSIT", amount_cents: 152500 };
    expect(suggestMatch(tx, lines, new Set())?.id).toBe("b");
    expect(suggestMatch(tx, lines, new Set(["b"]))?.id).toBe("a");
    expect(suggestMatch(tx, lines, new Set(["a", "b"]))).toBeNull();
    expect(fingerprint(tx)).toBe("2026-11-03|152500|deposit");
  });
});
