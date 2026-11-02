import "server-only";

// Connected accounts for companies and owners, made with Stripe's Accounts v2 API. Stripe manages risk and
// covers losses ("Managed Risk", required on this platform since Nov 2026: Stripe refuses the old Express
// `type`), each account pays its own Stripe fees, and gets the full Stripe Dashboard. Payments stay direct
// charges on the account (Stripe-Account header), so money goes straight to the company or owner.

const V2_VERSION = "2026-10-28.endive";

async function v2<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe isn't set up for Parcel Manage yet.");
  const res = await fetch(`https://api.stripe.com/v2/${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": V2_VERSION, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe error ${res.status}`);
  return json as T;
}

/** A new connected account that can take card and bank (ACH) payments. Returns its id (acct_…). */
export async function createConnectedAccount(input: { name: string; email: string | null; individual: boolean; metadata: Record<string, string> }): Promise<string> {
  const created = await v2<{ id: string }>("POST", "core/accounts", {
    ...(input.email ? { contact_email: input.email } : {}),
    display_name: input.name.slice(0, 100),
    dashboard: "full",
    identity: { country: "us", entity_type: input.individual ? "individual" : "company" },
    defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
    configuration: { merchant: { capabilities: { card_payments: { requested: true }, ach_debit_payments: { requested: true } } } },
    metadata: input.metadata,
  });
  return created.id;
}

/** Stripe's own sign-up page for the account (business details, bank, identity). */
export async function onboardingLink(account: string, back: string): Promise<string> {
  const link = await v2<{ url: string }>("POST", "core/account_links", {
    account,
    use_case: { type: "account_onboarding", account_onboarding: { configurations: ["merchant"], refresh_url: back, return_url: back } },
  });
  return link.url;
}

/** Whether the account can take card payments yet. */
export async function canTakePayments(account: string): Promise<boolean> {
  const a = await v2<{ configuration?: { merchant?: { capabilities?: { card_payments?: { status?: string } } } } }>("GET", `core/accounts/${encodeURIComponent(account)}?include=configuration.merchant`);
  return a.configuration?.merchant?.capabilities?.card_payments?.status === "active";
}
