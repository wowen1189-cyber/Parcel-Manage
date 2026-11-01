import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveCompanyAccess } from "@/lib/session";
import { admin, cleanup, createTestCompany, createTestUser, type TestUser } from "./helpers";

// CLAUDE.md rule 1: every row belongs to one company, and nobody outside it can see or change it.

let alice: TestUser;
let bob: TestUser;
let companyA: { id: string; subdomain: string };
let companyB: { id: string; subdomain: string };
let propertyA: string;

beforeAll(async () => {
  alice = await createTestUser("alice");
  bob = await createTestUser("bob");
  companyA = await createTestCompany(alice, "a");
  companyB = await createTestCompany(bob, "b");

  const entity = await alice.client.from("entity").insert({ company_id: companyA.id, name: "A Holdings LLC" }).select().single();
  expect(entity.error).toBeNull();
  const property = await alice.client
    .from("property")
    .insert({ company_id: companyA.id, entity_id: entity.data!.id, name: "A Tower", kind: "residential" })
    .select()
    .single();
  expect(property.error).toBeNull();
  propertyA = property.data!.id;
});

afterAll(cleanup);

describe("company isolation", () => {
  it("lets a company see its own rows", async () => {
    const { data } = await alice.client.from("property").select("id").eq("id", propertyA);
    expect(data).toHaveLength(1);
  });

  it("hides one company's rows from another company", async () => {
    const byId = await bob.client.from("property").select("id").eq("id", propertyA);
    const all = await bob.client.from("property").select("id, company_id");
    expect(byId.data).toEqual([]);
    expect(all.data?.every((p) => p.company_id === companyB.id)).toBe(true);
  });

  it("hides SIM REI's data from a second company", async () => {
    const simrei = await admin.from("company").select("id").eq("subdomain", "simreipm").single();
    expect(simrei.data).toBeTruthy();
    const [company, properties, contacts, units] = await Promise.all([
      bob.client.from("company").select("id").eq("id", simrei.data!.id),
      bob.client.from("property").select("id").eq("company_id", simrei.data!.id),
      bob.client.from("contact").select("id").eq("company_id", simrei.data!.id),
      bob.client.from("unit").select("id").eq("company_id", simrei.data!.id),
    ]);
    expect(company.data).toEqual([]);
    expect(properties.data).toEqual([]);
    expect(contacts.data).toEqual([]);
    expect(units.data).toEqual([]);
  });

  it("stops a company from writing into another company", async () => {
    const insert = await bob.client.from("contact").insert({ company_id: companyA.id, kind: "person", first_name: "Intruder" });
    expect(insert.error).not.toBeNull();
    const update = await bob.client.from("property").update({ name: "Hacked" }).eq("id", propertyA).select();
    expect(update.data).toEqual([]);
    const check = await admin.from("property").select("name").eq("id", propertyA).single();
    expect(check.data?.name).toBe("A Tower");
  });

  it("hides another company's team and profiles", async () => {
    const members = await bob.client.from("membership").select("id").eq("company_id", companyA.id);
    const profile = await bob.client.from("profile").select("id").eq("id", alice.id);
    expect(members.data).toEqual([]);
    expect(profile.data).toEqual([]);
  });
});

describe("company subdomains", () => {
  it("gives a member access on their own company's address", async () => {
    const access = await resolveCompanyAccess(alice.client, alice.id, companyA.subdomain);
    expect(access.status).toBe("ok");
  });

  it("shows nothing to a user signed in on another company's address", async () => {
    const access = await resolveCompanyAccess(bob.client, bob.id, companyA.subdomain);
    expect(access).toEqual({ status: "no-access" });
  });

  it("recognizes an address that belongs to no company", async () => {
    const access = await resolveCompanyAccess(bob.client, bob.id, "zz-test-nobody-here");
    expect(access).toEqual({ status: "unknown-subdomain" });
  });

  it("refuses reserved and taken addresses", async () => {
    const reserved = await bob.client.rpc("subdomain_available", { p_subdomain: "www" });
    const taken = await bob.client.rpc("subdomain_available", { p_subdomain: companyA.subdomain });
    expect(reserved.data).toBe(false);
    expect(taken.data).toBe(false);
  });
});

describe("audit log", () => {
  it("records who created a record", async () => {
    const { data } = await alice.client.from("audit_log").select("action, actor_profile_id, table_name").eq("row_id", propertyA);
    expect(data).toContainEqual({ action: "insert", actor_profile_id: alice.id, table_name: "property" });
  });

  it("can't be edited or deleted by users", async () => {
    const del = await alice.client.from("audit_log").delete().eq("row_id", propertyA).select();
    expect(del.data ?? []).toEqual([]);
    const ins = await alice.client
      .from("audit_log")
      .insert({ company_id: companyA.id, table_name: "property", row_id: propertyA, action: "delete" });
    expect(ins.error).not.toBeNull();
  });
});
