import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, createTestCompany, createTestUser, type TestUser } from "./helpers";

// Leasing, autopay and To do rows belong to one company: staff of another company, a tenant of the
// company, and anonymous visitors can't read them (public pages read through the server only).

let staff: TestUser;
let other: TestUser;
let company: { id: string };

beforeAll(async () => {
  staff = await createTestUser("leasing");
  other = await createTestUser("other");
  company = await createTestCompany(staff, "leasing");
  await createTestCompany(other, "leasing-other");
  const c = staff.client;
  const entity = (await c.from("entity").insert({ company_id: company.id, name: "Leasing LLC" }).select().single()).data!;
  const property = (await c.from("property").insert({ company_id: company.id, entity_id: entity.id, name: "Leasing House", kind: "residential" }).select().single()).data!;
  const unit = (await c.from("unit").insert({ company_id: company.id, property_id: property.id, label: "Home", kind: "residential" }).select().single()).data!;
  const listing = await c.from("listing").insert({ company_id: company.id, unit_id: unit.id, headline: "Test home", rent_cents: 120000, status: "published" });
  if (listing.error) throw new Error(listing.error.message);
  const app = (await c.from("application").insert({ company_id: company.id, unit_id: unit.id, kind: "residential", rent_cents: 120000 }).select().single()).data!;
  await c.from("application_member").insert({ company_id: company.id, application_id: app.id, first_name: "Pat", email: "pat@example.test" });
  await c.from("guest_card").insert({ company_id: company.id, first_name: "Riley", email: "riley@example.test" });
  await c.from("automation_task").insert({ company_id: company.id, key: "test", kind: "test", title: "Test task" });
});

afterAll(cleanup);

describe("leasing isolation", () => {
  const tables = ["listing", "guest_card", "application", "application_member", "automation_task"] as const;

  it("staff see their own company's rows", async () => {
    for (const t of tables) expect((await staff.client.from(t).select("id")).data?.length, t).toBeGreaterThan(0);
  });

  it("another company's staff see none", async () => {
    for (const t of tables) expect((await other.client.from(t).select("id")).data, t).toEqual([]);
  });

  it("anonymous visitors see none, and can't write", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    for (const t of [...tables, "screening_report", "autopay", "rate_hit"] as const) expect((await anon.from(t).select("*")).data ?? [], t).toEqual([]);
    expect((await anon.from("guest_card").insert({ company_id: company.id, first_name: "Spam" })).error).not.toBeNull();
  });
});
