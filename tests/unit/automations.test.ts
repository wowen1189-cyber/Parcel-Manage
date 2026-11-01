import { describe, expect, it } from "vitest";
import { expiringWithin, inPreNoticeWindow, nextDueDate, pastDueMonth, preNoticeWindow, readAutomationSettings, renewalDecisionDue, rentReminderFor } from "@/lib/automation-rules";

describe("rent reminders", () => {
  it("goes out N days before the due date, across month ends", () => {
    expect(nextDueDate("2026-11-29", 1)).toBe("2026-12-01");
    expect(rentReminderFor("2026-11-28", 1, 3)).toBe("2026-12-01");
    expect(rentReminderFor("2026-11-27", 1, 3)).toBeNull();
    expect(rentReminderFor("2026-12-29", 1, 3)).toBe("2027-01-01");
  });
});

describe("late notices (83.56(3), drafted only)", () => {
  it("starts on the late-fee day", () => {
    expect(pastDueMonth("2026-11-05", 6)).toBeNull();
    expect(pastDueMonth("2026-11-06", 6)).toBe("2026-11");
  });
});

describe("83.575(2) pre-notice", () => {
  it("must go out within the 15 days before the 60-day notice period", () => {
    // Lease ends Mar 31: notice period starts Jan 30; pre-notice window Jan 15 – Jan 29.
    expect(preNoticeWindow("2027-03-31", 60)).toEqual({ opens: "2027-01-15", lastDay: "2027-01-29", periodStarts: "2027-01-30" });
    expect(inPreNoticeWindow("2027-01-14", "2027-03-31", 60)).toBe(false);
    expect(inPreNoticeWindow("2027-01-15", "2027-03-31", 60)).toBe(true);
    expect(inPreNoticeWindow("2027-01-29", "2027-03-31", 60)).toBe(true);
    expect(inPreNoticeWindow("2027-01-30", "2027-03-31", 60)).toBe(false);
  });
});

describe("renewals and insurance", () => {
  it("renewal decisions open inside the offer lead time", () => {
    expect(renewalDecisionDue("2026-11-01", "2027-01-30", 90)).toBe(true);
    expect(renewalDecisionDue("2026-11-01", "2027-02-01", 90)).toBe(false);
  });
  it("insurance within the reminder window, not after it lapses", () => {
    expect(expiringWithin("2026-11-01", "2026-11-30", 30)).toBe(true);
    expect(expiringWithin("2026-11-01", "2026-10-31", 30)).toBe(false);
  });
  it("settings fill in defaults", () => {
    expect(readAutomationSettings({ automations: { rentReminderDaysBefore: 5 } }).rentReminderDaysBefore).toBe(5);
    expect(readAutomationSettings(null).lateNoticeTasks).toBe(true);
    expect(readAutomationSettings(null).enabled).toBe(false);
  });
});
