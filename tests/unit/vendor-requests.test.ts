import { describe, expect, it } from "vitest";
import { canPay, hashToken, itemsNeeded, MAX_SENDS, newToken, reminderDue, requiredItems } from "@/lib/vendor-requests";

const vendor = { trade: "Plumbing", is_1099: true, w9_on_file: false, coi_expires_on: null as string | null, workers_comp_expires_on: null as string | null, dispatch_override: false };
const today = "2026-11-01";

describe("what to request", () => {
  it("asks an on-site vendor for a W-9, liability insurance and workers' comp", () => {
    expect(itemsNeeded(vendor, today)).toEqual(["w9", "coi", "workers_comp"]);
    expect(requiredItems(itemsNeeded(vendor, today))).toEqual(["w9", "coi"]);
  });
  it("asks again for insurance that ends within 30 days", () => {
    expect(itemsNeeded({ ...vendor, w9_on_file: true, coi_expires_on: "2026-11-20", workers_comp_expires_on: "2027-06-01" }, today)).toEqual(["coi"]);
    expect(itemsNeeded({ ...vendor, w9_on_file: true, coi_expires_on: "2027-06-01", workers_comp_expires_on: "2027-06-01" }, today)).toEqual([]);
  });
  it("asks an off-site vendor (utility, supplier) only for a W-9", () => {
    expect(itemsNeeded({ ...vendor, trade: "Utility" }, today)).toEqual(["w9"]);
  });
  it("won't pay a 1099 vendor without a W-9", () => {
    expect(canPay(vendor)).toBe(false);
    expect(canPay({ ...vendor, w9_on_file: true })).toBe(true);
    expect(canPay({ ...vendor, is_1099: false })).toBe(true);
  });
});

describe("reminders", () => {
  const now = new Date("2026-11-10T14:00:00Z");
  const open = { last_sent_at: "2026-11-07T14:00:00Z", send_count: 2, completed_at: null, cancelled_at: null };
  it("are due every 3 days until the request is done", () => {
    expect(reminderDue(open, now)).toBe(true);
    expect(reminderDue({ ...open, last_sent_at: "2026-11-08T14:00:00Z" }, now)).toBe(false);
    expect(reminderDue({ ...open, completed_at: "2026-11-09T00:00:00Z" }, now)).toBe(false);
    expect(reminderDue({ ...open, cancelled_at: "2026-11-09T00:00:00Z" }, now)).toBe(false);
    expect(reminderDue({ ...open, send_count: MAX_SENDS }, now)).toBe(false);
  });
});

describe("private links", () => {
  it("stores only a hash of the token", () => {
    const { token, hash } = newToken();
    expect(token.length).toBeGreaterThanOrEqual(30);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });
});
