-- Bank feeds through Stripe Financial Connections (Wesley Owen, Nov 2, 2026; lib/bank-feeds.ts).
-- A company links its own bank accounts once; Stripe refreshes transactions daily and the nightly job
-- (app/api/cron/bank-feeds) brings them into bank_transaction for reconciling. Balances are pulled only when
-- someone asks (each pull is a Stripe charge). Stripe holds the bank sign-in; we keep only Stripe's ids.

alter table public.company add column stripe_fc_customer_id text;   -- the Stripe customer that holds the company's links

alter table public.bank_account
  add column fc_account_id text unique,            -- Stripe Financial Connections account (fca_…)
  add column fc_institution text,
  add column fc_status text,                       -- active | inactive | disconnected (Stripe's)
  add column fc_linked_at timestamptz,
  add column fc_synced_at timestamptz,
  add column fc_balance_cents bigint,              -- the bank's current balance, as of fc_balance_as_of
  add column fc_balance_as_of timestamptz;

-- What each company's feeds cost us each month, for software billing (docs/02 "Bank feeds").
create table public.bank_feed_usage (
  company_id uuid not null references public.company(id) on delete cascade,
  month date not null,                             -- first of the month
  linked_accounts int not null default 0,          -- most accounts linked at once that month
  balance_pulls int not null default 0,
  primary key (company_id, month)
);
alter table public.bank_feed_usage enable row level security;
create policy bank_feed_usage_member_read on public.bank_feed_usage for select using (public.is_member(company_id));

-- Count a balance pull (server code, under the member's own session).
create or replace function public.count_balance_pull(p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_company) then raise exception 'Not a member'; end if;
  insert into public.bank_feed_usage (company_id, month, balance_pulls) values (p_company, date_trunc('month', now())::date, 1)
  on conflict (company_id, month) do update set balance_pulls = bank_feed_usage.balance_pulls + 1;
end $$;
grant execute on function public.count_balance_pull(uuid) to authenticated;
