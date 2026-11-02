import { describe, expect, it } from "vitest";
import { pickPaymentAccount } from "@/lib/payment-account-rules";

const company = { stripe_account_id: "acct_company", stripe_charges_enabled: true };
const owner = (id: string | null, enabled: boolean) => ({ id: "own1", name: "Sample Holdings LLC", stripe_account_id: id, stripe_charges_enabled: enabled });

describe("which Stripe account a lease's rent goes to", () => {
  it("pays the property owner's own account when it's approved", () => {
    expect(pickPaymentAccount(company, owner("acct_owner", true))).toEqual({ ready: true, account: "acct_owner", ownerId: "own1" });
  });
  it("never falls back to the company account for an owner whose sign-up isn't finished", () => {
    expect(pickPaymentAccount(company, owner("acct_owner", false))).toEqual({ ready: false, reason: "owner_setup_unfinished", ownerName: "Sample Holdings LLC" });
  });
  it("uses the company account for owners without their own", () => {
    expect(pickPaymentAccount(company, owner(null, false))).toEqual({ ready: true, account: "acct_company", ownerId: null });
    expect(pickPaymentAccount(company, null)).toEqual({ ready: true, account: "acct_company", ownerId: null });
  });
  it("is off until something is connected and approved", () => {
    expect(pickPaymentAccount({ stripe_account_id: "acct_company", stripe_charges_enabled: false }, null).ready).toBe(false);
    expect(pickPaymentAccount(null, null)).toEqual({ ready: false, reason: "not_connected" });
  });
});
