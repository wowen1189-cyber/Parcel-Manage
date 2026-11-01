import { describe, expect, it } from "vitest";
import { claimDeadlines, depositDeadlines, settlement } from "@/lib/deposits";

describe("security deposit deadlines (83.49(3))", () => {
  it("gives 15 days to return in full and 30 days to send a claim notice", () => {
    expect(depositDeadlines("2027-01-31")).toEqual({ returnBy: "2027-02-15", claimNoticeBy: "2027-03-02" });
  });
  it("counts the objection window from receipt and the balance from the notice date", () => {
    expect(claimDeadlines("2027-02-10", "certified_mail")).toEqual({ objectionEnds: "2027-03-02", balanceDueBy: "2027-03-12" });
    expect(claimDeadlines("2027-02-10", "email_addendum").objectionEnds).toBe("2027-02-25");
  });
  it("applies the deposit only after a claim, then refunds the rest", () => {
    expect(settlement(150000, 40000, true)).toEqual({ applyCents: 40000, refundCents: 110000, stillOwedCents: 0 });
    expect(settlement(150000, 200000, true)).toEqual({ applyCents: 150000, refundCents: 0, stillOwedCents: 50000 });
    expect(settlement(150000, 40000, false)).toEqual({ applyCents: 0, refundCents: 150000, stillOwedCents: 40000 });
  });
});
