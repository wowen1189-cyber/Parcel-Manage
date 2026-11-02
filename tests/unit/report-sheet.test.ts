import { describe, expect, it } from "vitest";
import { reportSheet } from "@/lib/report-sheet";

describe("report as a spreadsheet", () => {
  it("has a title, filters, a bold header, typed cells and a bold totals row", () => {
    const cols = [{ key: "tenant", label: "Tenant" }, { key: "due", label: "Due", kind: "date" as const }, { key: "owed", label: "Owed", kind: "money" as const }];
    const sheet = reportSheet("Collections", "As of Nov 2, 2026", cols, [{ tenant: "Sample Tenant", due: "2026-10-01", owed: 145050 }, { tenant: "Other", due: null, owed: 0 }], { tenant: "Total", owed: 145050 });
    expect(sheet[0]).toEqual([{ value: "Collections", fontWeight: "bold" }]);
    expect(sheet[3]).toEqual([{ value: "Tenant", fontWeight: "bold" }, { value: "Due", fontWeight: "bold" }, { value: "Owed", fontWeight: "bold" }]);
    expect(sheet[4][2]).toEqual({ value: 1450.5, type: Number, format: "#,##0.00" });
    expect((sheet[4][1] as { value: Date }).value.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(sheet[5][1]).toEqual({ value: null });
    expect(sheet[6][0]).toEqual({ value: "Total", type: String, fontWeight: "bold" });
  });
});
