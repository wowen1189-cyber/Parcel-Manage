import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_RULES } from "@/lib/business-rules";
import { findSymptom, SAFETY_OPTIONS, technicianSummary, triagePriority, visibleQuestions, type Symptom } from "@/lib/triage";
import { checkEntryWindow, dateToZoned, zonedToDate } from "@/lib/work-orders";

const TZ = "America/New_York";
const rules = DEFAULT_BUSINESS_RULES;

describe("triage priority", () => {
  const ac = findSymptom("hvac", "ac", "warm")!.symptom;

  it("starts from the symptom's base priority", () => {
    expect(triagePriority(ac, { temp: "80°F or below", risk: "No" }).priority).toBe("Urgent");
  });

  it("makes an AC outage an emergency above 80°F or with children or elderly people at home", () => {
    expect(triagePriority(ac, { temp: "Above 80°F", risk: "No" }).priority).toBe("Emergency");
    expect(triagePriority(ac, { temp: "80°F or below", risk: "Yes" }).priority).toBe("Emergency");
  });

  it("lets a lower-priority rule win when it's the only match, and ignores answers to hidden questions", () => {
    const s: Symptom = {
      id: "x",
      label: "Test",
      basePriority: "Urgent",
      questions: [
        { id: "a", question: "A?", options: ["Yes", "No"] },
        { id: "b", question: "B?", options: ["Yes", "No"], showIf: { question: "a", answers: ["Yes"] } },
      ],
      rules: [
        { when: { a: ["No"] }, priority: "Routine" },
        { when: { b: ["Yes"] }, priority: "Emergency" },
      ],
    };
    expect(triagePriority(s, { a: "No" }).priority).toBe("Routine");
    expect(visibleQuestions(s, { a: "No" }).map((q) => q.id)).toEqual(["a"]);
    expect(triagePriority(s, { a: "No", b: "Yes" }).priority).toBe("Routine");
    expect(triagePriority(s, { a: "Yes", b: "Yes" }).priority).toBe("Emergency");
  });

  it("always has the gas and fire safety buttons as emergencies", () => {
    expect(SAFETY_OPTIONS.map((o) => [o.id, o.priority])).toEqual([
      ["gas", "Emergency"],
      ["fire", "Emergency"],
    ]);
  });

  it("writes a plain summary for the vendor", () => {
    const text = technicianSummary({ priority: "Emergency", item: "Air conditioner", symptom: ac, answers: { temp: "Above 80°F" }, room: "Whole home", entryOk: true, pets: true });
    expect(text).toContain("Priority: Emergency");
    expect(text).toContain("Air conditioner: Not cooling or blowing warm air.");
    expect(text).toContain("Above 80°F");
    expect(text).toContain("OK to enter if no one is home.");
    expect(text).toContain("Pets in the home.");
  });
});

describe("entry window (Fla. Stat. 83.53(2))", () => {
  const at = (local: string) => zonedToDate(local, TZ);
  const check = (start: string, end: string, basis: "notice" | "tenant_agreed" | "emergency" | "vacant", notice: string | null) =>
    checkEntryWindow({ start: at(start), end: at(end), basis, noticeGivenAt: notice ? at(notice) : null, timeZone: TZ, rules });

  it("converts company local time correctly, including across daylight saving", () => {
    expect(at("2026-11-05T09:30").toISOString()).toBe("2026-11-05T14:30:00.000Z"); // EST, UTC-5
    expect(at("2026-07-05T09:30").toISOString()).toBe("2026-07-05T13:30:00.000Z"); // EDT, UTC-4
    expect(dateToZoned(new Date("2026-11-05T14:30:00Z"), TZ)).toBe("2026-11-05T09:30");
  });

  it("needs at least 24 hours' notice for a repair visit", () => {
    expect(check("2026-11-05T09:00", "2026-11-05T11:00", "notice", "2026-11-04T09:00")).toEqual({ ok: true });
    const short = check("2026-11-05T09:00", "2026-11-05T11:00", "notice", "2026-11-04T10:00");
    expect(short.ok).toBe(false);
    expect(check("2026-11-05T09:00", "2026-11-05T11:00", "notice", null).ok).toBe(false);
  });

  it("keeps repair visits between 7:30 a.m. and 8:00 p.m.", () => {
    expect(check("2026-11-05T07:00", "2026-11-05T09:00", "notice", "2026-11-03T09:00").ok).toBe(false);
    expect(check("2026-11-05T19:00", "2026-11-05T20:30", "notice", "2026-11-03T09:00").ok).toBe(false);
    expect(check("2026-11-05T07:30", "2026-11-05T20:00", "notice", "2026-11-03T09:00")).toEqual({ ok: true });
  });

  it("needs no notice or time window in an emergency, with the tenant's consent, or in a vacant unit", () => {
    for (const basis of ["emergency", "tenant_agreed", "vacant"] as const) {
      expect(check("2026-11-05T22:00", "2026-11-05T23:00", basis, null)).toEqual({ ok: true });
    }
  });

  it("rejects a visit that ends before it starts", () => {
    expect(check("2026-11-05T11:00", "2026-11-05T10:00", "emergency", null).ok).toBe(false);
  });
});
