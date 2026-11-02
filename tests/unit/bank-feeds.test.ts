import { describe, expect, it } from "vitest";
import { balanceAtEndOf, dayIn, feedRows, pairLinked, type FcTransaction } from "@/lib/bank-feeds";

const tz = "America/New_York";
// 2026-11-02 03:00 UTC is still Nov 1 in Florida.
const lateNov1 = Date.UTC(2026, 10, 2, 3, 0) / 1000;

describe("bank feeds", () => {
  it("brings in posted transactions only, dated in the company's time zone, keyed by Stripe's id", () => {
    const txns: FcTransaction[] = [
      { id: "fctxn_1", amount: 145000, description: "ZZ TENANT ACH", status: "posted", transacted_at: lateNov1 - 86_400, status_transitions: { posted_at: lateNov1, void_at: null } },
      { id: "fctxn_2", amount: -8999, description: "", status: "posted", transacted_at: lateNov1 },
      { id: "fctxn_3", amount: -500, description: "Pending card", status: "pending", transacted_at: lateNov1 },
      { id: "fctxn_4", amount: -700, description: "Voided", status: "void", transacted_at: lateNov1 },
    ];
    expect(feedRows(txns, tz)).toEqual([
      { posted_on: "2026-11-01", description: "ZZ TENANT ACH", amount_cents: 145000, fingerprint: "fc:fctxn_1" },
      { posted_on: "2026-11-01", description: "Bank transaction", amount_cents: -8999, fingerprint: "fc:fctxn_2" },
    ]);
    expect(dayIn(lateNov1, "UTC")).toBe("2026-11-02");
  });

  it("matches linked accounts to ours by last 4, leaving the rest for a person", () => {
    const banks = [
      { id: "b1", last4: "1111", fc_account_id: null },
      { id: "b2", last4: "2222", fc_account_id: "fca_other" },
      { id: "b3", last4: "3333", fc_account_id: null },
    ];
    const r = pairLinked(
      [
        { id: "fca_a", last4: "1111", institution_name: "ZZ Bank" },
        { id: "fca_b", last4: "2222", institution_name: "ZZ Bank" },
        { id: "fca_c", last4: "9999", institution_name: "ZZ Bank" },
      ],
      banks,
    );
    expect(r.pairs.map((p) => [p.bank.id, p.fc.id])).toEqual([["b1", "fca_a"]]);
    expect(r.unmatched.map((u) => u.id)).toEqual(["fca_b", "fca_c"]);
  });

  it("works a past day's closing balance back from today's", () => {
    const rows = [
      { posted_on: "2026-11-01", amount_cents: 5000 },
      { posted_on: "2026-11-03", amount_cents: 20000 },
      { posted_on: "2026-11-04", amount_cents: -7500 },
    ];
    expect(balanceAtEndOf("2026-11-02", 100000, rows)).toBe(100000 - 20000 + 7500);
  });
});
