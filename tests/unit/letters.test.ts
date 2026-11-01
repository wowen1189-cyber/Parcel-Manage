import { describe, expect, it } from "vitest";
import { courtHolidays, LETTERS, monthToMonthEnd, threeDayDeadline, type LetterContext } from "@/lib/letters";

describe("3-day notice deadline (83.56(3))", () => {
  it("skips the delivery day, weekends and court holidays", () => {
    expect(threeDayDeadline("2026-11-02")).toBe("2026-11-05"); // Mon → Thu
    expect(threeDayDeadline("2026-11-06")).toBe("2026-11-12"); // Fri → Mon, Tue (Wed 11th Veterans Day), Thu
    expect(threeDayDeadline("2026-11-24")).toBe("2026-12-01"); // Thanksgiving and the day after are skipped
  });
  it("adds 5 days for mailing", () => {
    expect(threeDayDeadline("2026-11-02", true)).toBe("2026-11-12");
  });
  it("knows the holidays that move", () => {
    const h = courtHolidays(2027);
    expect(h.has("2027-01-18")).toBe(true); // MLK Day
    expect(h.has("2027-05-31")).toBe(true); // Memorial Day
    expect(h.has("2027-11-25")).toBe(true); // Thanksgiving
    expect(h.has("2027-12-24")).toBe(true); // Christmas observed (Christmas is a Saturday)
  });
});

describe("month-to-month ending (83.57(3))", () => {
  it("ends at the close of the monthly period at least 30 days out", () => {
    expect(monthToMonthEnd("2026-11-01")).toBe("2026-12-31");
    expect(monthToMonthEnd("2026-10-15")).toBe("2026-11-30");
  });
});

describe("letters", () => {
  const c: LetterContext = { companyName: "Sample PM", companyAddress: "1 Office St, Eustis, FL 32726", companyPhone: "(352) 555-0100", landlordName: "Sample LLC", tenantNames: "Jordan Sample", premises: "5 Oak Ln, Eustis, FL 32726", county: "Lake", rentCents: 150000, balanceCents: 160000, rentOwedCents: 150000, leaseEnd: "2027-06-30", today: "2026-11-02", senderName: "Pat Office", senderTitle: "Office Administrator" };
  it("prints the statutory 3-day form with the amount, county and deadline", () => {
    const text = LETTERS.find((l) => l.id === "three-day")!.body(c, { amount: "1500", delivered: "2026-11-02" }).join("\n");
    expect(text).toContain("indebted to me in the sum of $1,500.00 dollars for the rent and use of the premises 5 Oak Ln, Eustis, FL 32726, Lake County, Florida");
    expect(text).toContain("within 3 days (excluding Saturday, Sunday, and legal holidays)");
    expect(text).toContain("on or before the November 5, 2026");
  });
  it("prints the statutory deposit claim form", () => {
    const text = LETTERS.find((l) => l.id === "deposit-claim")!.body(c, { amount: "250", reason: "carpet replacement" }).join("\n");
    expect(text).toContain("must object in writing to this deduction from your security deposit within 15 days");
  });
  it("signs every letter with the sender's name and title", () => {
    for (const l of LETTERS) expect(l.body(c, {}).join("\n")).toContain("Pat Office, Office Administrator");
  });
});
