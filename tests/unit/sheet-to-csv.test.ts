import { describe, expect, it } from "vitest";
import { sheetToCsv } from "@/lib/import/sheet-to-csv";

describe("Excel sheet to CSV", () => {
  it("writes dates as YYYY-MM-DD, quotes commas and quotes, and keeps blanks", () => {
    const csv = sheetToCsv([
      ["Unit", "Tenant", "Rent", "Lease To", "Notes"],
      ["101", "Doe, Jane", 1450, new Date("2027-05-31T00:00:00Z"), 'Says "hi"'],
      ["102", null, 0, null, ""],
    ]);
    expect(csv).toBe('Unit,Tenant,Rent,Lease To,Notes\n101,"Doe, Jane",1450,2027-05-31,"Says ""hi"""\n102,,0,,');
  });
});
