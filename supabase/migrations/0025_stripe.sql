-- Online rent payments with Stripe Connect: each company connects its own Stripe account (payouts go to the
-- company's bank, not Parcel Manage). Tenants pay by bank transfer (ACH, free to tenants) or card (a
-- convenience fee shown before paying, CLAUDE.md rule 6). Stripe's webhooks record each payment once.
alter table public.company
  add column stripe_account_id text,
  add column stripe_charges_enabled boolean not null default false;

create table public.stripe_event (
  id text primary key,                   -- Stripe event id; makes webhook handling idempotent
  company_id uuid references public.company(id) on delete cascade,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_event enable row level security;   -- service role only

create index on public.payment (processor_ref);
