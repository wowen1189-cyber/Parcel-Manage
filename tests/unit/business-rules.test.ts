import { describe, expect, it } from "vitest";
import { businessRulesSchema, DEFAULT_BUSINESS_RULES, FLORIDA_LAW, readBusinessRules } from "@/lib/business-rules";
import { displayValue, parseRulesForm, RULE_SECTIONS } from "@/lib/business-rules-form";

function formFrom(rules = DEFAULT_BUSINESS_RULES, overrides: Record<string, string | null> = {}) {
  const form = new FormData();
  for (const section of RULE_SECTIONS) {
    for (const field of section.fields) {
      const v = displayValue(field, rules);
      if (field.type === "boolean") {
        if (v) form.set(field.path, "on");
      } else form.set(field.path, String(v));
    }
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) form.delete(k);
    else form.set(k, v);
  }
  return form;
}

describe("SIM REI default business rules", () => {
  it("are valid and match docs/02-business-rules.md", () => {
    expect(businessRulesSchema.safeParse(DEFAULT_BUSINESS_RULES).success).toBe(true);
    expect(DEFAULT_BUSINESS_RULES.screening.incomeMultiple).toBe(2.5);
    expect(DEFAULT_BUSINESS_RULES.fees).toMatchObject({ applicationFeePerAdultCents: 7500, adminFeeCents: 8500 });
    expect(DEFAULT_BUSINESS_RULES.pets).toMatchObject({ maxPets: 2, petFeeCents: 35000, petRentPerPetCents: 2500 });
    expect(DEFAULT_BUSINESS_RULES.maintenance.falseEmergencyFeeCents).toBe(10000);
  });
});

describe("Florida law limits (Fla. Stat. 83.53(2))", () => {
  it("won't accept less than 24 hours' entry notice", () => {
    expect(FLORIDA_LAW.entryNoticeMinHours).toBe(24);
    const result = parseRulesForm(formFrom(DEFAULT_BUSINESS_RULES, { "maintenance.entryNoticeHours": "12" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["maintenance.entryNoticeHours"]).toMatch(/83\.53/);
  });

  it("won't accept repair visits before 7:30 AM or after 8:00 PM", () => {
    const early = parseRulesForm(formFrom(DEFAULT_BUSINESS_RULES, { "maintenance.entryWindowStart": "07:00" }));
    const late = parseRulesForm(formFrom(DEFAULT_BUSINESS_RULES, { "maintenance.entryWindowEnd": "21:00" }));
    expect(early.ok).toBe(false);
    expect(late.ok).toBe(false);
  });
});

describe("business rules form", () => {
  it("round-trips the defaults", () => {
    const result = parseRulesForm(formFrom());
    expect(result).toEqual({ ok: true, rules: DEFAULT_BUSINESS_RULES });
  });

  it("reads dollars as cents and unchecked boxes as false", () => {
    const result = parseRulesForm(
      formFrom(DEFAULT_BUSINESS_RULES, { "fees.adminFeeCents": "$90.50", "fees.refundAdminFeeIfDenied": null }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rules.fees.adminFeeCents).toBe(9050);
      expect(result.rules.fees.refundAdminFeeIfDenied).toBe(false);
    }
  });

  it("flags a late fee day that isn't after the due day", () => {
    const result = parseRulesForm(formFrom(DEFAULT_BUSINESS_RULES, { "rent.lateFeeDay": "1" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["rent.lateFeeDay"]).toBeTruthy();
  });
});

describe("readBusinessRules", () => {
  it("fills missing settings with the defaults", () => {
    expect(readBusinessRules({})).toEqual(DEFAULT_BUSINESS_RULES);
    const rules = readBusinessRules({ businessRules: { rent: { lateFeeCents: 7500 } } });
    expect(rules.rent.lateFeeCents).toBe(7500);
    expect(rules.rent.dueDay).toBe(1);
  });
});
