-- Phase 1: fields needed to bring a real portfolio over from AppFolio (rent roll + vendor directory).

-- ---------- contacts: mailing address and tags ----------
alter table public.contact
  add column address_line1 text,
  add column address_line2 text,
  add column city text,
  add column state text,
  add column postal_code text,
  add column tags text[] not null default '{}';

-- ---------- properties ----------
alter table public.property
  add column address_line2 text,
  add column property_type text check (property_type in ('single_family', 'multi_family', 'commercial', 'mixed_use')),
  add column amenities text[] not null default '{}',
  add column notes text;

-- ---------- units ----------
alter table public.unit
  add column amenities text[] not null default '{}',
  add column access_notes text,       -- key codes, lockbox; staff only, never shown in portals
  add column notes text,
  add column updated_at timestamptz not null default now();

create trigger unit_updated_at before update on public.unit for each row execute function public.set_updated_at();

-- ---------- leases ----------
-- Late fee terms per lease. Null means "use the company's business rules".
-- Part II of Fla. Stat. ch. 83 (residential) sets no late-fee amount or cap; a late fee is only
-- collectible if the written lease states it, and 83.43 lets the lease designate it as rent.
-- (The $20/20% "reasonable late fee" rule in 83.808 is for self-storage only.) Commercial leases
-- fall under Part I of chapter 83 and follow the lease itself.
alter table public.lease
  add column move_in_on date,
  add column move_out_on date,                    -- set when the tenant gives notice
  add column deposit_pending_cents int not null default 0,  -- authorized/pending, not yet received
  add column late_fee_grace_days int check (late_fee_grace_days between 0 and 31),
  add column late_fee_flat_cents int check (late_fee_flat_cents >= 0),
  add column late_fee_pct numeric(5,2) check (late_fee_pct >= 0 and late_fee_pct <= 100),
  add column next_rent_increase_on date,
  add column next_rent_cents int check (next_rent_cents >= 0),
  add column notes text,
  -- Balance carried over from the previous system, shown until opening balances are posted to the books.
  add column opening_balance_cents int,
  add column opening_balance_as_of date;

alter table public.lease drop constraint if exists lease_rent_cents_check;
alter table public.lease add constraint lease_rent_cents_check check (rent_cents >= 0);  -- owner-occupied space can be $0

alter table public.lease_tenant
  add column role text not null default 'tenant' check (role in ('tenant', 'occupant'));

-- Recurring monthly charges besides rent (utilities, pest, parking, pet rent ...).
create table public.recurring_charge (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  lease_id uuid not null references public.lease(id) on delete cascade,
  charge_type text not null default 'other',
  description text not null,
  amount_cents int not null check (amount_cents > 0),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.recurring_charge (company_id, lease_id);
alter table public.recurring_charge enable row level security;
create policy recurring_charge_member_all on public.recurring_charge for all
  using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger recurring_charge_updated_at before update on public.recurring_charge for each row execute function public.set_updated_at();
create trigger recurring_charge_audit after insert or update or delete on public.recurring_charge for each row execute function public.audit_row();

-- ---------- vendors ----------
alter table public.vendor
  add column payment_method text check (payment_method in ('ach', 'check', 'mailed_check', 'card', 'other')),
  add column workers_comp_expires_on date,
  add column auto_insurance_expires_on date,
  add column license_expires_on date,
  add column epa_cert_expires_on date,
  add column contract_expires_on date,
  add column w9_received_on date,
  add column dispatch_override boolean not null default false,  -- allow work orders despite missing paperwork
  add column last_paid_on date,
  add column notes text,
  add column is_active boolean not null default true,
  add column updated_at timestamptz not null default now();
create trigger vendor_updated_at before update on public.vendor for each row execute function public.set_updated_at();

-- Lists filter and sort by these.
create index on public.contact (company_id, last_name);
create index on public.vendor (company_id);
create index on public.lease_tenant (company_id, contact_id);
