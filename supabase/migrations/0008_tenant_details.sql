-- Phase 1: tenant details from the AppFolio tenant directory (co-signers, occupants, late fee terms,
-- vehicles without make/model, pets).

-- Co-signers (guarantors) are on the lease for money but don't live there.
alter table public.lease_tenant drop constraint if exists lease_tenant_role_check;
alter table public.lease_tenant add constraint lease_tenant_role_check check (role in ('tenant', 'occupant', 'guarantor'));

-- Full late fee terms. Fla. Stat. ch. 83 Part II sets no amount or cap; whatever the written lease
-- states applies (83.43 lets the lease designate fees as rent). Null = company default.
alter table public.lease
  add column late_fee_basis text check (late_fee_basis in ('rent', 'all_charges')),   -- what a percent fee is taken of
  add column late_fee_daily_cents int check (late_fee_daily_cents >= 0),             -- added each day after the first fee
  add column late_fee_daily_max_cents int check (late_fee_daily_max_cents >= 0),     -- cap on the daily fees
  add column nsf_fee_cents int check (nsf_fee_cents >= 0),                           -- returned payment fee in the lease
  add column certified_funds_only boolean not null default false,                    -- money order / cashier's check only
  add column rent_reminders boolean not null default true,
  add column commercial_lease_type text;                                             -- e.g. Modified Gross

-- A plate can be on file before the make and model are.
alter table public.vehicle alter column make_model drop not null;

-- Pets on a lease. Assistance animals are not pets: no pet rent, fee or limits apply to them.
create table public.pet (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  lease_id uuid not null references public.lease(id) on delete cascade,
  kind text not null,                  -- 'Cat', 'Golden Doodle', 'Mix Unknown' as given
  name text,
  weight_lbs numeric(5,1),
  is_assistance_animal boolean not null default false,
  notes text,
  updated_source text not null default 'office' check (updated_source in ('office', 'tenant_portal', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.pet (company_id, lease_id);
alter table public.pet enable row level security;
create policy pet_member_all on public.pet for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger pet_updated_at before update on public.pet for each row execute function public.set_updated_at();
create trigger pet_audit after insert or update or delete on public.pet for each row execute function public.audit_row();

create index on public.vehicle (company_id, lease_id);
create index on public.renters_insurance (company_id, lease_id);
