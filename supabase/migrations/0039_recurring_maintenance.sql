-- Recurring maintenance (AC filters, pest control, gutter cleaning, fire extinguisher checks): each schedule
-- creates a work order on its date (source 'recurring'); the office assigns and schedules it as usual, so
-- the 83.53(2) entry notice rules still apply to occupied units. lib/recurring-maintenance.ts.
create table public.recurring_work_order (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  property_id uuid not null references public.property(id) on delete cascade,
  unit_id uuid references public.unit(id) on delete cascade,
  title text not null check (length(title) between 2 and 200),
  details text,
  vendor_id uuid references public.vendor(id) on delete set null,
  frequency text not null default 'quarterly' check (frequency in ('monthly', 'quarterly', 'twice_yearly', 'yearly')),
  next_on date not null,
  active boolean not null default true,
  last_work_order_id uuid references public.work_order(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.recurring_work_order (company_id, next_on) where active;
alter table public.recurring_work_order enable row level security;
create policy recurring_work_order_member_all on public.recurring_work_order for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger recurring_work_order_updated_at before update on public.recurring_work_order for each row execute function public.set_updated_at();
create trigger recurring_work_order_audit after insert or update or delete on public.recurring_work_order for each row execute function public.audit_row();
