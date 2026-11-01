import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTestUser, rand, type TestUser } from "./helpers";

// Charges, payments and returns post balanced entries to the owner's books (CLAUDE.md rule 5), and
// deposits go to trust, never operating cash. Posted books can never be deleted, so this uses the kept
// "Test books" company with its own owner (entity) each run, and only reads that owner's lines.

let user: TestUser;
let company: { id: string };
let entityId: string;
let leaseId: string;

async function balances() {
  const { data } = await user.client.from("journal_line").select("debit_cents, credit_cents, gl_account(number), journal_entry!inner(status, entity_id)").eq("company_id", company.id).eq("journal_entry.entity_id", entityId);
  const by: Record<string, number> = {};
  for (const l of data ?? []) by[l.gl_account.number] = (by[l.gl_account.number] ?? 0) + Number(l.debit_cents) - Number(l.credit_cents);
  return by;
}

beforeAll(async () => {
  user = await createTestUser("books");
  const existing = await admin.from("company").select("id").eq("subdomain", "zz-test-books").maybeSingle();
  company = { id: existing.data?.id ?? (await admin.from("company").insert({ name: "Test books (kept)", subdomain: "zz-test-books" }).select("id").single()).data!.id };
  await admin.from("membership").insert({ company_id: company.id, profile_id: user.id, role: "admin" });
  const entity = await user.client.from("entity").insert({ company_id: company.id, name: `Ledger LLC ${rand()}` }).select().single();
  entityId = entity.data!.id;
  const property = await user.client.from("property").insert({ company_id: company.id, entity_id: entity.data!.id, name: "Books Home", kind: "residential" }).select().single();
  const unit = await user.client.from("unit").insert({ company_id: company.id, property_id: property.data!.id, label: "Home", kind: "residential" }).select().single();
  const lease = await user.client.from("lease").insert({ company_id: company.id, unit_id: unit.data!.id, start_date: "2027-01-01", rent_cents: 150000 }).select().single();
  leaseId = lease.data!.id;
});

afterAll(cleanup);

describe("tenant ledger posting", () => {
  it("posts rent as receivable and income", async () => {
    const { error } = await user.client.rpc("post_charge", { p_lease: leaseId, p_type: "rent", p_description: "Rent for January 2027", p_amount: 150000, p_due: "2027-01-01" });
    expect(error).toBeNull();
    expect(await balances()).toMatchObject({ "1100": 150000, "4000": -150000 });
  });

  it("posts a payment against the receivable", async () => {
    const { error } = await user.client.rpc("record_payment", { p_lease: leaseId, p_method: "check", p_amount: 100000, p_received: "2027-01-03", p_reference: "1001" });
    expect(error).toBeNull();
    expect(await balances()).toMatchObject({ "1000": 100000, "1100": 50000 });
  });

  it("keeps a security deposit in trust", async () => {
    await user.client.rpc("record_payment", { p_lease: leaseId, p_method: "check", p_amount: 150000, p_received: "2027-01-03", p_purpose: "deposit" });
    expect(await balances()).toMatchObject({ "1010": 150000, "2100": -150000, "1000": 100000 });
  });

  it("reverses a returned payment and charges the returned-payment fee", async () => {
    const pay = await user.client.from("payment").select("id").eq("lease_id", leaseId).eq("purpose", "rent").single();
    const { error } = await user.client.rpc("return_payment", { p_payment: pay.data!.id, p_date: "2027-01-08", p_fee: 5000 });
    expect(error).toBeNull();
    expect(await balances()).toMatchObject({ "1000": 0, "1100": 155000, "4030": -5000 });
    const after = await user.client.from("payment").select("status").eq("id", pay.data!.id).single();
    expect(after.data?.status).toBe("returned");
  });

  it("keeps the books balanced", async () => {
    const total = Object.values(await balances()).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it("refuses a $0 charge", async () => {
    const { error } = await user.client.rpc("post_charge", { p_lease: leaseId, p_type: "rent", p_description: "Nothing", p_amount: 0, p_due: "2027-02-01" });
    expect(error?.message).toMatch(/more than \$0/);
  });
});
