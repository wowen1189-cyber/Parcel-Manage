import { describe, expect, it } from "vitest";
import { cleanMapping, columnShapes, guessMapping, money, normalize, readSheet, sameName, usDate } from "@/lib/import/generic";

// Made-up exports in the shapes other programs use. Never real tenant data (CLAUDE.md).
const BUILDIUM_RENT_ROLL = `Rent Roll
As of 11/01/2026

Property,Unit,Tenants,Lease Start,Lease End,Rent,Deposits Held,Balance Due,Bed/Bath,Sq Ft
Maple Court,101,"Doe, Jane",01/01/2026,12/31/2026,"$1,250.00","$1,250.00",$0.00,2/1,850
Maple Court,102,Vacant,,,"$0.00",,,1/1,600
Maple Court,103,Sample Holdings LLC,3/1/25,2/28/26,"$1,400.00","$1,400.00","($50.00)",2/2,900
,,,,,,,,,
Total,,,,,"$2,650.00",,,,
`;

const RENT_MANAGER_RENT_ROLL = `Property Name,Unit Name,Resident First Name,Resident Last Name,Monthly Rent,Security Deposit,Current Balance,Move In Date,Lease Expiration,Unit Type
Oak Plaza,Suite A,Pat,Example,"2,000.00",500.00,125.50,2024-06-01,2027-05-31,Retail
Oak Plaza,Suite B,,,0.00,,,,,Retail
`;

describe("reading other programs' exports", () => {
  it("finds the heading row under title lines", () => {
    const sheet = readSheet(BUILDIUM_RENT_ROLL, "rent_roll");
    expect(sheet.headers[0]).toBe("Property");
    expect(sheet.headerRow).toBe(2);
  });

  it("matches Buildium-style headings", () => {
    const sheet = readSheet(BUILDIUM_RENT_ROLL, "rent_roll");
    const m = guessMapping("rent_roll", sheet.headers);
    const col = (k: string) => (m[k] == null ? null : sheet.headers[m[k]!]);
    expect(col("property")).toBe("Property");
    expect(col("unit")).toBe("Unit");
    expect(col("tenant")).toBe("Tenants");
    expect(col("rent")).toBe("Rent");
    expect(col("deposit")).toBe("Deposits Held");
    expect(col("balance")).toBe("Balance Due");
    expect(col("lease_start")).toBe("Lease Start");
    expect(col("lease_end")).toBe("Lease End");
    expect(col("bedsbaths")).toBe("Bed/Bath");
    expect(col("sqft")).toBe("Sq Ft");
  });

  it("turns rows into leases, skipping blanks and totals", () => {
    const sheet = readSheet(BUILDIUM_RENT_ROLL, "rent_roll");
    const data = normalize("rent_roll", sheet, guessMapping("rent_roll", sheet.headers));
    if (data.kind !== "rent_roll") throw new Error("kind");
    expect(data.records).toHaveLength(3);
    expect(data.skipped).toBe(1); // the Total row (blank lines are dropped when reading)
    const [jane, vacant, llc] = data.records;
    expect(jane.tenant).toMatchObject({ kind: "person", first_name: "Jane", last_name: "Doe" });
    expect(jane).toMatchObject({ rent_cents: 125000, deposit_cents: 125000, balance_cents: 0, start_date: "2026-01-01", end_date: "2026-12-31", beds: 2, baths: 1, sqft: 850 });
    expect(vacant.tenant).toBeNull();
    expect(llc.tenant).toMatchObject({ kind: "business", business_name: "Sample Holdings LLC" });
    expect(llc).toMatchObject({ balance_cents: -5000, start_date: "2025-03-01", end_date: "2026-02-28" });
  });

  it("reads Rent Manager-style split names and commercial units", () => {
    const sheet = readSheet(RENT_MANAGER_RENT_ROLL, "rent_roll");
    const data = normalize("rent_roll", sheet, guessMapping("rent_roll", sheet.headers));
    if (data.kind !== "rent_roll") throw new Error("kind");
    expect(data.records[0]).toMatchObject({ property: "Oak Plaza", unit: "Suite A", kind: "commercial", rent_cents: 200000, deposit_cents: 50000, balance_cents: 12550, move_in_on: "2024-06-01", end_date: "2027-05-31" });
    expect(data.records[0].tenant).toMatchObject({ first_name: "Pat", last_name: "Example" });
    expect(data.records[1].tenant).toBeNull();
  });

  it("fills a property name down onto the unit rows under its heading", () => {
    const csv = `Property,Unit,Tenant,Rent\nPine Villas,,,\n,1,Lee Sample,900\n,2,Kim Sample,950\n`;
    const sheet = readSheet(csv, "rent_roll");
    const data = normalize("rent_roll", sheet, guessMapping("rent_roll", sheet.headers));
    expect(data.records.map((r) => ("property" in r ? r.property : ""))).toEqual(["Pine Villas", "Pine Villas"]);
  });

  it("flags values it can't read, with the spreadsheet row number", () => {
    const csv = `Property,Unit,Tenant,Rent,Lease Start\nElm,1,Lee Sample,abc,13/45/2026\n`;
    const sheet = readSheet(csv, "rent_roll");
    const data = normalize("rent_roll", sheet, guessMapping("rent_roll", sheet.headers));
    expect(data.issues.map((i) => i.row)).toContain(2);
    expect(data.issues.some((i) => i.message.includes('"abc"'))).toBe(true);
  });

  it("reads vendors and owners from any program", () => {
    const vendors = readSheet(`Vendor Name,Category,Phone,Email,1099,Insurance Expiration\nAcme Plumbing Inc,,(352) 555-0100,office@example.com,Yes,6/30/2027\n`, "vendors");
    const v = normalize("vendors", vendors, guessMapping("vendors", vendors.headers));
    expect(v.records[0]).toMatchObject({ kind: "business", business_name: "Acme Plumbing Inc", trade: "Plumbing", is_1099: true, coi_expires_on: "2027-06-30" });
    const owners = readSheet(`Owner Name,Email,EIN,Properties\nMaple Court LLC,owner@example.com,12-3456789,"Maple Court; Oak Plaza"\n`, "owners");
    const o = normalize("owners", owners, guessMapping("owners", owners.headers));
    expect(o.records[0]).toMatchObject({ name: "Maple Court LLC", entity_type: "LLC", tax_id_last4: "6789", properties: ["Maple Court", "Oak Plaza"] });
  });
});

describe("values", () => {
  it("reads money in every common shape", () => {
    expect(money("$1,380.50")).toBe(138050);
    expect(money("(10.50)")).toBe(-1050);
    expect(money("-$10.50")).toBe(-1050);
    expect(money("")).toBeNull();
    expect(money("n/a")).toBeNull();
  });
  it("reads US dates and rejects impossible ones", () => {
    expect(usDate("5/1/2026")).toBe("2026-05-01");
    expect(usDate("05/01/26")).toBe("2026-05-01");
    expect(usDate("2026-05-01")).toBe("2026-05-01");
    expect(usDate("May 1, 2026")).toBe("2026-05-01");
    expect(usDate("1-May-2026")).toBe("2026-05-01");
    expect(usDate("2/30/2026")).toBeNull();
    expect(usDate("soon")).toBeNull();
  });
  it("treats street-suffix spellings as the same property", () => {
    expect(sameName("12 Forest Lane", "12 forest ln")).toBe(true);
    expect(sameName("12 Forest Lane", "14 Forest Lane")).toBe(false);
  });
});

describe("AI column matching", () => {
  it("sends only headings and the kind of values, never the values", () => {
    const sheet = readSheet(BUILDIUM_RENT_ROLL, "rent_roll");
    const shapes = columnShapes(sheet).join("\n");
    expect(shapes).toContain("Lease Start: dates");
    expect(shapes).toContain("Rent: money");
    expect(shapes).not.toContain("Jane");
    expect(shapes).not.toContain("1,250");
  });
  it("ignores column numbers that don't exist", () => {
    expect(cleanMapping("owners", ["A", "B"], { name: 1, email: 7, phone: "x", tax_id: -1 })).toMatchObject({ name: 1, email: null, phone: null, tax_id: null });
  });
});
