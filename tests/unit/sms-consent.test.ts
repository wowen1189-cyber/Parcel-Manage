import { describe, expect, it } from "vitest";
import { smsConsentText, smsStatus } from "@/lib/sms-consent";

describe("text message consent", () => {
  it("states what texts are for, rates, STOP/HELP and that it isn't required", () => {
    const t = smsConsentText("Sample PM");
    expect(t).toContain("Sample PM");
    expect(t).toMatch(/Message and data rates may apply/);
    expect(t).toMatch(/Reply STOP/);
    expect(t).toMatch(/HELP/);
    expect(t).toMatch(/isn't a condition of renting/);
  });
  it("reads the status from the contact", () => {
    expect(smsStatus({ sms_opt_in: true, sms_opt_out_at: null })).toBe("opted_in");
    expect(smsStatus({ sms_opt_in: false, sms_opt_out_at: "2026-11-02T10:00:00Z" })).toBe("opted_out");
    expect(smsStatus({ sms_opt_in: false, sms_opt_out_at: null })).toBe("not_asked");
  });
});
