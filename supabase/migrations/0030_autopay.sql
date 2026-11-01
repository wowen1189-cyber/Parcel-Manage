-- Autopay: a tenant saves a bank account (Stripe, on the company's own connected account) and the balance due
-- is drafted on the day they pick. Bank only, so autopay never adds a card fee (CLAUDE.md rule 6).
create table public.autopay (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  lease_id uuid not null references public.lease(id) on delete cascade,
  contact_id uuid references public.contact(id),
  stripe_customer_id text not null,
  stripe_payment_method_id text not null,
  bank_label text,
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  max_cents int check (max_cents is null or max_cents > 0),
  active boolean not null default true,
  last_run_month text,
  last_result text,
  created_at timestamptz not null default now()
);
create unique index autopay_one_active_per_lease on public.autopay (lease_id) where active;
alter table public.autopay enable row level security;
create policy autopay_member_all on public.autopay for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy autopay_portal_read on public.autopay for select using (lease_id in (select public.portal_lease_ids()));
create trigger autopay_audit after insert or update or delete on public.autopay for each row execute function public.audit_row();
