import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, createTestCompany, createTestUser, type TestUser } from "./helpers";

// Tenant portal: a tenant signs in with the e-mail on their tenant record and sees only their own lease,
// unit, ledger and requests; they can't open a request on someone else's unit or read staff notes.

let staff: TestUser;
let tenant: TestUser;
let company: { id: string };
const ids: Record<string, string> = {};

beforeAll(async () => {
  staff = await createTestUser("pm");
  tenant = await createTestUser("tenant");
  company = await createTestCompany(staff, "portal");
  const c = staff.client;
  const entity = (await c.from("entity").insert({ company_id: company.id, name: "Portal LLC" }).select().single()).data!;
  const property = (await c.from("property").insert({ company_id: company.id, entity_id: entity.id, name: "Portal Duplex", kind: "residential" }).select().single()).data!;
  for (const label of ["A", "B"]) {
    const unit = (await c.from("unit").insert({ company_id: company.id, property_id: property.id, label, kind: "residential" }).select().single()).data!;
    const lease = (await c.from("lease").insert({ company_id: company.id, unit_id: unit.id, start_date: "2027-01-01", rent_cents: 100000, status: "active" }).select().single()).data!;
    const contact = (await c.from("contact").insert({ company_id: company.id, kind: "person", first_name: label, email: label === "A" ? tenant.email.toUpperCase() : "someone-else@example.test" }).select().single()).data!;
    await c.from("lease_tenant").insert({ company_id: company.id, lease_id: lease.id, contact_id: contact.id, is_primary: true });
    ids[`unit${label}`] = unit.id;
    ids[`lease${label}`] = lease.id;
    ids[`contact${label}`] = contact.id;
  }
  const wo = (await c.from("work_order").insert({ company_id: company.id, property_id: property.id, unit_id: ids.unitA, title: "Leak", source: "staff" }).select().single()).data!;
  const ev = await c.from("work_order_event").insert([
    { company_id: company.id, work_order_id: wo.id, kind: "created", detail: {} },
    { company_id: company.id, work_order_id: wo.id, kind: "note", detail: { note: "Staff only" } },
  ]);
  if (ev.error) throw new Error(ev.error.message);
  ids.property = property.id;
});

afterAll(cleanup);

describe("tenant portal", () => {
  it("sees nothing before claiming, then links by verified e-mail (any letter case)", async () => {
    expect((await tenant.client.from("lease").select("id")).data).toEqual([]);
    const { data, error } = await tenant.client.rpc("claim_portal", { p_company: company.id });
    expect(error).toBeNull();
    expect(data).toBe(1);
  });

  it("sees only their own lease and unit", async () => {
    expect((await tenant.client.from("lease").select("id")).data?.map((l) => l.id)).toEqual([ids.leaseA]);
    expect((await tenant.client.from("unit").select("id")).data?.map((u) => u.id)).toEqual([ids.unitA]);
    expect((await tenant.client.from("contact").select("id")).data?.map((x) => x.id)).toEqual([ids.contactA]);
  });

  it("sees their request's timeline but not staff notes", async () => {
    const events = (await tenant.client.from("work_order_event").select("kind")).data?.map((e) => e.kind);
    expect(events).toEqual(["created"]);
  });

  it("can open a request for their own unit only", async () => {
    const mine = await tenant.client.from("work_order").insert({ company_id: company.id, property_id: ids.property, unit_id: ids.unitA, title: "Sink clogged", source: "portal", reported_by_contact_id: ids.contactA }).select("number").single();
    expect(mine.error).toBeNull();
    const theirs = await tenant.client.from("work_order").insert({ company_id: company.id, property_id: ids.property, unit_id: ids.unitB, title: "Sneaky", source: "portal", reported_by_contact_id: ids.contactA });
    expect(theirs.error).not.toBeNull();
  });

  it("can message the office only as themselves", async () => {
    const ok = await tenant.client.from("message").insert({ company_id: company.id, thread_key: `contact:${ids.contactA}`, contact_id: ids.contactA, channel: "portal", direction: "inbound", status: "received", body: "Hi" });
    expect(ok.error).toBeNull();
    const spoof = await tenant.client.from("message").insert({ company_id: company.id, thread_key: `contact:${ids.contactB}`, contact_id: ids.contactB, channel: "portal", direction: "inbound", status: "received", body: "Hi" });
    expect(spoof.error).not.toBeNull();
  });

  it("can't post to the ledger", async () => {
    const { error } = await tenant.client.rpc("post_charge", { p_lease: ids.leaseA, p_type: "other", p_description: "Credit me", p_amount: 100, p_due: "2027-01-01" });
    expect(error).not.toBeNull();
  });
});

describe("owner portal", () => {
  it("shows an owner only the owners whose records list their e-mail", async () => {
    const owner = await createTestUser("owner-portal");
    const c = staff.client;
    const mine = (await c.from("entity").insert({ company_id: company.id, name: "Mine LLC", email: `x@example.test, ${owner.email.toUpperCase()}` }).select().single()).data!;
    await c.from("entity").insert({ company_id: company.id, name: "Not Mine LLC", email: "other@example.test" });
    const seen = (await owner.client.from("entity").select("id, name")).data ?? [];
    expect(seen.map((e) => e.name)).toEqual(["Mine LLC"]);
    expect(seen[0].id).toBe(mine.id);
    expect((await owner.client.from("lease").select("id")).data).toEqual([]);
  });
});
