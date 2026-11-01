import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTestCompany, createTestUser, rand, type TestUser } from "./helpers";

// Database rules from CLAUDE.md and the Phase 0 checklist: books can't be rewritten, invites only
// work for the invited email, and work order numbers count up per company.

let owner: TestUser;
let other: TestUser;
let companyA: { id: string; subdomain: string };
let companyB: { id: string; subdomain: string };

beforeAll(async () => {
  owner = await createTestUser("owner");
  other = await createTestUser("other");
  companyA = await createTestCompany(owner, "rules-a");
  companyB = await createTestCompany(other, "rules-b");
});

afterAll(cleanup);

describe("invites", () => {
  async function invite(email: string) {
    const token = randomBytes(32).toString("base64url");
    const { error } = await owner.client.from("invitation").insert({
      company_id: companyA.id,
      email,
      role: "property_manager",
      title: "Office Administrator",
      token_hash: createHash("sha256").update(token).digest("hex"),
      invited_by: owner.id,
    });
    expect(error).toBeNull();
    return token;
  }

  it("refuses an invite accepted with a different email", async () => {
    const invitee = await createTestUser("invitee");
    const token = await invite(invitee.email);
    const { error } = await other.client.rpc("accept_invitation", { p_token: token });
    expect(error?.message).toMatch(/different email/);
    const members = await admin.from("membership").select("id").eq("company_id", companyA.id).eq("profile_id", other.id);
    expect(members.data).toEqual([]);
  });

  it("adds the invited person with the role and title from the invite", async () => {
    const invitee = await createTestUser("invitee2");
    const token = await invite(invitee.email);
    const { data, error } = await invitee.client.rpc("accept_invitation", { p_token: token });
    expect(error).toBeNull();
    expect(data).toBe(companyA.id);
    const member = await admin.from("membership").select("role, title").eq("company_id", companyA.id).eq("profile_id", invitee.id).single();
    expect(member.data).toEqual({ role: "property_manager", title: "Office Administrator" });

    const again = await invitee.client.rpc("accept_invitation", { p_token: token });
    expect(again.error?.message).toMatch(/invalid or has expired/);
  });

  it("refuses a made-up token", async () => {
    const { error } = await other.client.rpc("accept_invitation", { p_token: "not-a-real-token" });
    expect(error?.message).toMatch(/invalid or has expired/);
  });

  it("lets only admins create invites", async () => {
    const outsider = await other.client.from("invitation").insert({
      company_id: companyA.id,
      email: "someone@example.test",
      token_hash: rand(),
    });
    expect(outsider.error).not.toBeNull();
  });
});

describe("work order numbers", () => {
  async function newWorkOrder(user: TestUser, companyId: string) {
    const entity = await user.client.from("entity").insert({ company_id: companyId, name: "WO LLC" }).select().single();
    const property = await user.client
      .from("property")
      .insert({ company_id: companyId, entity_id: entity.data!.id, name: "WO Property", kind: "residential" })
      .select()
      .single();
    return async () => {
      const wo = await user.client
        .from("work_order")
        .insert({ company_id: companyId, property_id: property.data!.id, title: "Leaky faucet" })
        .select("number")
        .single();
      expect(wo.error).toBeNull();
      return wo.data!.number;
    };
  }

  it("start at 1 for each company and count up", async () => {
    const createA = await newWorkOrder(owner, companyA.id);
    const createB = await newWorkOrder(other, companyB.id);
    expect(await createA()).toBe(1);
    expect(await createA()).toBe(2);
    expect(await createB()).toBe(1);
  });
});

describe("posted journal entries (CLAUDE.md rule 5)", () => {
  // Posted entries can't be deleted, so they live in one long-lived test company that's reused every run.
  let booksId: string;
  let cash: string;
  let income: string;
  let entityId: string;

  beforeAll(async () => {
    const existing = await admin.from("company").select("id").eq("subdomain", "zz-test-books").maybeSingle();
    booksId =
      existing.data?.id ??
      (await admin.from("company").insert({ name: "Test books (kept)", subdomain: "zz-test-books" }).select("id").single()).data!.id;
    await admin.from("membership").insert({ company_id: booksId, profile_id: owner.id, role: "admin" });

    const suffix = rand();
    const accounts = await owner.client
      .from("gl_account")
      .insert([
        { company_id: booksId, number: `1000-${suffix}`, name: "Cash", type: "asset" },
        { company_id: booksId, number: `4000-${suffix}`, name: "Rent income", type: "income" },
      ])
      .select("id, type");
    expect(accounts.error).toBeNull();
    cash = accounts.data!.find((a) => a.type === "asset")!.id;
    income = accounts.data!.find((a) => a.type === "income")!.id;
    const entity = await owner.client.from("entity").insert({ company_id: booksId, name: "Books LLC" }).select().single();
    entityId = entity.data!.id;
  });

  async function draftEntry(debit: number, credit: number) {
    const entry = await owner.client
      .from("journal_entry")
      .insert({ company_id: booksId, entity_id: entityId, entry_date: "2026-11-01", memo: "Test rent" })
      .select()
      .single();
    expect(entry.error).toBeNull();
    const lines = await owner.client.from("journal_line").insert([
      // A multi-row insert must spell out every column, or the missing ones are sent as null.
      { company_id: booksId, journal_entry_id: entry.data!.id, gl_account_id: cash, debit_cents: debit, credit_cents: 0 },
      { company_id: booksId, journal_entry_id: entry.data!.id, gl_account_id: income, debit_cents: 0, credit_cents: credit },
    ]);
    expect(lines.error).toBeNull();
    return entry.data!.id;
  }

  const post = (id: string) => owner.client.from("journal_entry").update({ status: "posted" }).eq("id", id).select();

  it("won't post an entry that doesn't balance", async () => {
    const id = await draftEntry(10000, 9000);
    const { error } = await post(id);
    expect(error?.message).toMatch(/out of balance/);
  });

  it("can't be edited, un-posted, deleted or given new lines once posted", async () => {
    const id = await draftEntry(10000, 10000);
    expect((await post(id)).error).toBeNull();

    const edit = await owner.client.from("journal_entry").update({ memo: "Changed" }).eq("id", id).select();
    expect(edit.error?.message).toMatch(/cannot be changed/);
    const unpost = await owner.client.from("journal_entry").update({ status: "draft" }).eq("id", id).select();
    expect(unpost.error?.message).toMatch(/cannot be changed/);
    const del = await owner.client.from("journal_entry").delete().eq("id", id).select();
    expect(del.error?.message).toMatch(/cannot be deleted/);
    const line = await owner.client.from("journal_line").insert({ company_id: booksId, journal_entry_id: id, gl_account_id: cash, debit_cents: 1 });
    expect(line.error?.message).toMatch(/cannot be changed/);
    const adminDelete = await admin.from("journal_entry").delete().eq("id", id).select();
    expect(adminDelete.error?.message).toMatch(/cannot be deleted/);
  });

  it("can be marked reversed, and then never changed again", async () => {
    const id = await draftEntry(5000, 5000);
    expect((await post(id)).error).toBeNull();
    const reverse = await owner.client.from("journal_entry").update({ status: "reversed" }).eq("id", id).select();
    expect(reverse.error).toBeNull();
    const repost = await owner.client.from("journal_entry").update({ status: "posted" }).eq("id", id).select();
    expect(repost.error?.message).toMatch(/cannot be changed/);
  });
});
