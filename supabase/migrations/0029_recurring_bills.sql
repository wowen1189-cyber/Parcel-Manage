-- Recurring bills (lawn care, pest control, insurance, HOA): each creates a bill on schedule that still
-- needs approval before it posts or is paid (CLAUDE.md rule 4).
create table public.recurring_bill (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  vendor_id uuid not null references public.vendor(id),
  property_id uuid not null references public.property(id),
  amount_cents int not null check (amount_cents > 0),
  expense_account text not null default '5000',
  memo text not null,
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly', 'yearly')),
  next_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.recurring_bill enable row level security;
create policy recurring_bill_member_all on public.recurring_bill for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger recurring_bill_audit after insert or update or delete on public.recurring_bill for each row execute function public.audit_row();
