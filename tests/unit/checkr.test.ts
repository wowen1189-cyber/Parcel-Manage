import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { orderBody, reportToScreening, retryable, verifyTenantSignature } from "@/lib/integrations/checkr/rules";

const secret = "zz-test-webhook-secret";
const sign = (body: string, t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("Checkr", () => {
  it("accepts only correctly signed, recent webhooks", () => {
    const body = '{"id":"evt_test_1","type":"report.completed","data":{"id":"rp_test_1","order_id":"ord_test_1"}}';
    const now = 1_800_000_000_000;
    const t = now / 1000;
    expect(verifyTenantSignature(body, sign(body, t), secret, now)).toBe(true);
    expect(verifyTenantSignature(body + " ", sign(body, t), secret, now)).toBe(false);
    expect(verifyTenantSignature(body, sign(body, t - 600), secret, now)).toBe(false);
    expect(verifyTenantSignature(body, sign(body, t), "other-secret", now)).toBe(false);
    expect(verifyTenantSignature(body, null, secret, now)).toBe(false);
    expect(verifyTenantSignature(body, sign(body, t), undefined, now)).toBe(false);
  });

  it("orders with name and e-mail only, the rental address, and the company as requester", () => {
    const b = orderBody({
      pkg: "essential",
      applicant: { first_name: "Herbert", last_name: "Humphrey", email: "zz-applicant@example.com" },
      property: { name: "ZZ Test Home", street: "9 Test St", unit: "2B", city: "Eustis", state: "FL", zipcode: "32726" },
      company: { id: "co_1", name: "ZZ Property Co", email: "office@example.com" },
    });
    expect(b.order.package).toBe("essential");
    expect(b.order.applicant).toEqual({ first_name: "Herbert", last_name: "Humphrey", email: "zz-applicant@example.com" });
    expect(b.order.property).toMatchObject({ street: "9 Test St", unit: "2B", zipcode: "32726" });
    expect(b.order.original_requester).toMatchObject({ external_id: "co_1", type: "business", name: "ZZ Property Co" });
    expect(JSON.stringify(b)).not.toMatch(/ssn|dob|payer/);
  });

  it("turns a report into the facts the criteria use, and lists what a person should check", () => {
    const { result, notes } = reportToScreening(
      {
        id: "rp_test_1",
        credit_report: { status: "consider", credit_score: 641, collections: { records: [{ classification: "rental_leasing" }, { classification: "cable_cellular" }] } },
        eviction_history: { status: "consider", records: [{ file_date: "2021-05-01", judgment_date: "2021-08-02", judgment_amount_cents: 120000 }] },
        criminal_history: { status: "clear", records: [] },
        sex_offender_registry: { status: "clear" },
        global_watchlist: { status: "consider" },
      },
      "2026-11-02",
    );
    expect(result).toEqual({ creditScore: 641, evictionYearsAgo: 5.3, owesLandlord: true, utilityOrCarProblems: true, criminalRecords: true });
    expect(notes.join(" ")).toContain("eviction judgment shows money owed");
    expect(notes.join(" ")).toContain('Marked "consider"');
  });

  it("a clear report fills in a clean result; no score is not a failure", () => {
    const { result, notes } = reportToScreening({ id: "rp_test_2", credit_report: { status: "clear", credit_score: null }, eviction_history: { status: "clear", records: [] }, criminal_history: { status: "clear", records: [] } }, "2026-11-02");
    expect(result).toEqual({ creditScore: null, evictionYearsAgo: null, owesLandlord: false, utilityOrCarProblems: false, criminalRecords: false });
    expect(notes).toEqual(["No credit score on file (thin or unavailable file): no minimum score is required."]);
  });

  it("retries only server errors and rate limits", () => {
    expect([500, 503, 429].map(retryable)).toEqual([true, true, true]);
    expect([400, 401, 402, 403, 404, 422].map(retryable)).toEqual([false, false, false, false, false, false]);
  });
});
