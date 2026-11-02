-- Rent paid straight to each owner (LLC): an owner can have its own Stripe connected account and bank.
-- A lease's online payments go to the account of the owner of its property, else the company's account
-- (a broker managing for others keeps the company account, which pays out to its trust account,
-- Fla. Stat. 475.25(1)(k)). See lib/payment-account.ts.
alter table public.entity
  add column stripe_account_id text,
  add column stripe_charges_enabled boolean not null default false;
create unique index entity_stripe_account on public.entity (stripe_account_id) where stripe_account_id is not null;

-- The account the tenant's saved bank was set up on; autopay drafts must run on that same account.
alter table public.autopay add column stripe_account_id text;
