-- Checkr Tenant screening orders (lib/integrations/checkr). Only Checkr's ids and statuses are kept here, never
-- the full report: the facts the criteria use go into screening_report (provider 'checkr'), the rest stays in
-- Checkr, opened from the application. The idempotency key is saved before the order is placed, so a retry can
-- never order (and pay for) the same screening twice.
create table public.screening_order (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  application_member_id uuid not null references public.application_member(id) on delete cascade,
  provider text not null default 'checkr',
  package text not null,
  idempotency_key uuid not null unique,
  order_id text unique,                  -- ord_…
  status text not null default 'placing' check (status in ('placing', 'failed', 'waiting_for_applicant', 'pending', 'completed', 'canceled')),
  live_mode boolean,
  application_url text,
  report_id text,                        -- rp_…
  product_statuses jsonb not null default '{}',
  notes text[] not null default '{}',
  error text,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index screening_order_member on public.screening_order (company_id, application_member_id, created_at desc);
alter table public.screening_order enable row level security;
create policy screening_order_member_all on public.screening_order for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger screening_order_updated_at before update on public.screening_order for each row execute function public.set_updated_at();
create trigger screening_order_audit after insert or update or delete on public.screening_order for each row execute function public.audit_row();

-- Checkr webhook deliveries already handled (Checkr may deliver an event more than once).
create table public.checkr_event (
  id text primary key,                   -- evt_…
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.checkr_event enable row level security;
