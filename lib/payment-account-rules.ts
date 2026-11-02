// The rule behind lib/payment-account.ts, kept pure for tests.

type Account = { stripe_account_id: string | null; stripe_charges_enabled: boolean };

export type PaymentAccount =
  | { ready: true; account: string; ownerId: string | null }
  | { ready: false; reason: "not_connected" | "owner_setup_unfinished"; ownerName?: string };

/**
 * An owner with its own account is paid there, but only once Stripe has approved it: rent never falls back
 * to the company's account for an owner who has started their own (that would mix the owner's money).
 * Owners without one use the company's account.
 */
export function pickPaymentAccount(company: Account | null, owner: (Account & { id: string; name: string }) | null): PaymentAccount {
  if (owner?.stripe_account_id) {
    return owner.stripe_charges_enabled ? { ready: true, account: owner.stripe_account_id, ownerId: owner.id } : { ready: false, reason: "owner_setup_unfinished", ownerName: owner.name };
  }
  if (company?.stripe_account_id && company.stripe_charges_enabled) return { ready: true, account: company.stripe_account_id, ownerId: null };
  return { ready: false, reason: "not_connected" };
}
