import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guessMapping, normalize, readSheet, type ImportKind } from "@/lib/import/generic";
import { saveImport } from "@/lib/import/save";
import { cleanup, createTestCompany, createTestUser, type TestUser } from "./helpers";

// The Import data screen writes as the signed-in admin (RLS), never duplicates on a second run, and only
// moves properties off the "not set yet" owner. Made-up data only.

let user: TestUser;
let company: { id: string };

const run = (kind: ImportKind, csv: string, commit = true) => {
  const sheet = readSheet(csv, kind);
  return saveImport(user.client, company.id, normalize(kind, sheet, guessMapping(kind, sheet.headers)), { commit, asOf: "2026-11-01" });
};

const ROLL = `Property,Unit,Tenants,Lease Start,Lease End,Rent,Deposits Held,Balance Due,Email
Maple Court,101,"Doe, Jane",01/01/2026,12/31/2026,"$1,250.00","$1,250.00",$75.00,
Maple Court,102,Vacant,,,,,,
19 Birch Lane,,Lee Sample,06/01/2025,05/31/2026,"$1,600.00","$1,600.00",,
`;

beforeAll(async () => {
  user = await createTestUser("import");
  company = await createTestCompany(user, "import");
});

afterAll(cleanup);

describe("Import data", () => {
  it("checks without writing anything", async () => {
    const r = await run("rent_roll", ROLL, false);
    expect(r.done[0]).toContain("Will add 2 properties, 3 units and 2 leases");
    const { count } = await user.client.from("property").select("id", { count: "exact", head: true }).eq("company_id", company.id);
    expect(count).toBe(0);
  });

  it("imports a rent roll from any software", async () => {
    await run("rent_roll", ROLL);
    const { data: leases } = await user.client.from("lease").select("rent_cents, deposit_cents, opening_balance_cents, opening_balance_as_of, end_date, unit(label, status, property(name, property_type))").eq("company_id", company.id).order("rent_cents");
    expect(leases).toHaveLength(2);
    expect(leases![0]).toMatchObject({ rent_cents: 125000, deposit_cents: 125000, opening_balance_cents: 7500, opening_balance_as_of: "2026-11-01", unit: { label: "101", status: "occupied", property: { name: "Maple Court", property_type: "multi_family" } } });
    // The Birch Lane lease ended before cutover: now month-to-month.
    expect(leases![1]).toMatchObject({ end_date: null, unit: { label: "Home", property: { property_type: "single_family" } } });
    const { data: vacant } = await user.client.from("unit").select("status").eq("company_id", company.id).eq("label", "102").single();
    expect(vacant!.status).toBe("vacant");
  });

  it("skips what's already there on a second run", async () => {
    const r = await run("rent_roll", ROLL);
    expect(r.done[0]).toContain("Added 0 properties, 0 units and 0 leases");
    const { count } = await user.client.from("lease").select("id", { count: "exact", head: true }).eq("company_id", company.id);
    expect(count).toBe(2);
  });

  it("puts properties under their owners", async () => {
    await run("owners", `Owner Name,Email,Properties\nMaple Court LLC,owner@example.com,Maple Court\n`);
    const { data } = await user.client.from("property").select("name, entity(name)").eq("company_id", company.id).eq("name", "Maple Court").single();
    expect(data!.entity.name).toBe("Maple Court LLC");
  });

  it("fills in tenant contact details without overwriting", async () => {
    await run("tenants", `First Name,Last Name,Email,Mobile\nJane,Doe,jane@example.com,(352) 555-0101\n`);
    const { data } = await user.client.from("contact").select("email, mobile").eq("company_id", company.id).eq("last_name", "Doe").single();
    expect(data).toMatchObject({ email: "jane@example.com", mobile: "(352) 555-0101" });
    await run("tenants", `First Name,Last Name,Email\nJane,Doe,other@example.com\n`);
    const again = await user.client.from("contact").select("email").eq("company_id", company.id).eq("last_name", "Doe").single();
    expect(again.data!.email).toBe("jane@example.com");
  });

  it("adds vendors once", async () => {
    const csv = `Vendor Name,Phone\nAcme Plumbing Inc,(352) 555-0100\n`;
    await run("vendors", csv);
    const r = await run("vendors", csv);
    expect(r.skipped[0]).toContain("1 vendor already on file");
    const { data } = await user.client.from("vendor").select("trade").eq("company_id", company.id);
    expect(data).toEqual([{ trade: "Plumbing" }]);
  });
});
