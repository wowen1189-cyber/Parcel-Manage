import { describe, expect, it } from "vitest";
import { autoReconcile, balanceAtEndOf, compareBalances, dayIn, feedRows, lastMonthEnd, pairLinked, type FcTransaction } from "@/lib/bank-feeds";

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

describe("bank vs Parcel Manage balance", () => {
  it("shows the difference, or that there's no bank balance yet", () => {
    expect(compareBalances(150000, 150000)).toEqual({ diffCents: 0, status: "match" });
    expect(compareBalances(150000, 162500)).toEqual({ diffCents: -12500, status: "off" });
    expect(compareBalances(null, 5000)).toEqual({ diffCents: null, status: "no_bank" });
  });
});

describe("automatic month-end reconcile", () => {
  const base = {
    monthEnd: "2026-10-31",
    bookLines: [
      { id: "opening", entry_date: "2026-09-30", amount_cents: 100000, cleared: true },
      { id: "rent", entry_date: "2026-10-05", amount_cents: 150000, cleared: false },
      { id: "fee", entry_date: "2026-10-20", amount_cents: -1200, cleared: false },
      { id: "check", entry_date: "2026-10-30", amount_cents: -40000, cleared: false }, // not cashed yet
      { id: "nov", entry_date: "2026-11-01", amount_cents: 9999, cleared: false },
    ],
  };
  const bankTxns = [
    { posted_on: "2026-10-05", status: "matched", journal_line_id: "rent" },
    { posted_on: "2026-10-20", status: "matched", journal_line_id: "fee" },
    { posted_on: "2026-11-02", status: "unmatched", journal_line_id: null }, // next month: ignored here
  ];

  it("reconciles when every bank item is matched and the balance ties, leaving uncashed checks outstanding", () => {
    expect(lastMonthEnd("2026-11-02")).toBe("2026-10-31");
    expect(autoReconcile({ ...base, bankBalanceCents: 248800, bankTxns })).toEqual({ ok: true, clearedCents: 248800, clear: ["rent", "fee"] });
  });

  it("leaves the month for a person when something isn't matched or the balance doesn't tie", () => {
    expect(autoReconcile({ ...base, bankBalanceCents: 248800, bankTxns: [...bankTxns, { posted_on: "2026-10-25", status: "unmatched", journal_line_id: null }] })).toEqual({ ok: false, reason: "1 bank transaction through 2026-10-31 not matched to the books yet." });
    expect(autoReconcile({ ...base, bankBalanceCents: 250000, bankTxns }).ok).toBe(false);
  });
});
