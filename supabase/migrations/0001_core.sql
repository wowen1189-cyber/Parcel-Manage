-- Parcel Manage — core schema (Phase 0–1 starting point)
-- Multi-company from day one: every business table has company_id and RLS.
-- Money is stored as integer cents. Extend with new migrations; never edit an applied one.

create extension if not exists "pgcrypto";

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- companies and people ----------
create table public.company (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  time_zone text not null default 'America/New_York',
  office_phone text,              -- shown to tenants (SIM REI: (352) 715-6203)
  office_email text,
  address text,
  default_county text,
  settings jsonb not null default '{}'::jsonb,   -- business rules (validated by Zod in the app)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- Every new login gets a profile row automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create type public.member_role as enum ('admin', 'property_manager', 'accountant', 'maintenance_coordinator', 'leasing_agent', 'read_only');

create table public.membership (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  profile_id uuid not null references public.profile(id) on delete cascade,
  role public.member_role not null default 'property_manager',
  title text,                          -- editable; used on letters, emails and signatures
  all_properties boolean not null default true,
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (company_id, profile_id)
);

-- Is the signed-in user a member of this company?
create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membership m
                 where m.company_id = cid and m.profile_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.has_role(cid uuid, roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membership m
                 where m.company_id = cid and m.profile_id = auth.uid() and m.status = 'active' and m.role = any(roles));
$$;

-- Does the signed-in user work at a company with this person? (Team screen, "Sent by" picker.)
create or replace function public.shares_company(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membership me
                 join public.membership them on them.company_id = me.company_id
                 where me.profile_id = auth.uid() and me.status = 'active' and them.profile_id = pid);
$$;

-- Invites by email. The link token is only in the email; we keep its SHA-256 hash.
create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'property_manager',
  title text,
  all_properties boolean not null default true,
  property_ids uuid[] not null default '{}',   -- used when all_properties is false
  token_hash text not null unique,
  invited_by uuid references public.profile(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profile(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index invitation_one_pending on public.invitation (company_id, lower(email)) where status = 'pending';

-- First sign-in: create a company and make the caller its admin.
create or replace function public.create_company(p_name text, p_time_zone text default 'America/New_York')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  insert into public.company (name, time_zone) values (p_name, p_time_zone) returning id into cid;
  insert into public.membership (company_id, profile_id, role) values (cid, auth.uid(), 'admin');
  return cid;
end $$;

create table public.contact (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  kind text not null check (kind in ('person', 'business')),
  first_name text, last_name text, business_name text,
  email text, mobile text, phone text,
  preferred_contact text check (preferred_contact in ('text', 'email', 'call')),
  sms_opt_in boolean not null default false,
  sms_opt_in_at timestamptz,
  sms_opt_out_at timestamptz,
  portal_profile_id uuid references public.profile(id),   -- tenant/vendor/owner portal login
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- portfolio ----------
create table public.entity (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  name text not null,                 -- e.g. 100 North Dewey St LLC
  entity_type text,                   -- LLC, S-corp, individual
  tax_id_last4 text,                  -- full tax IDs stored only in Vault
  created_at timestamptz not null default now()
);

create table public.property (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  entity_id uuid not null references public.entity(id),
  name text not null,
  kind text not null check (kind in ('residential', 'commercial', 'mixed')),
  address_line1 text, city text, state text default 'FL', postal_code text, county text,
  year_built int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_owner (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  property_id uuid not null references public.property(id) on delete cascade,
  owner_contact_id uuid not null references public.contact(id),
  ownership_pct numeric(6,3) not null check (ownership_pct > 0 and ownership_pct <= 100),
  unique (property_id, owner_contact_id)
);

create table public.membership_property (
  membership_id uuid not null references public.membership(id) on delete cascade,
  property_id uuid not null references public.property(id) on delete cascade,
  primary key (membership_id, property_id)
);

-- Accept an invite link. The signed-in email must match the invited email.
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  inv public.invitation;
  user_email text;
  mid uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  select email into user_email from auth.users where id = auth.uid();
  select * into inv from public.invitation
    where token_hash = encode(digest(p_token, 'sha256'), 'hex') and status = 'pending'
    for update;
  if not found or inv.expires_at < now() then
    raise exception 'This invite link is invalid or has expired.';
  end if;
  if lower(inv.email) <> lower(user_email) then
    raise exception 'This invite was sent to a different email address.';
  end if;
  insert into public.membership (company_id, profile_id, role, title, all_properties)
  values (inv.company_id, auth.uid(), inv.role, inv.title, inv.all_properties)
  on conflict (company_id, profile_id) do update
    set role = excluded.role, title = excluded.title, all_properties = excluded.all_properties, status = 'active'
  returning id into mid;
  insert into public.membership_property (membership_id, property_id)
    select mid, p from unnest(inv.property_ids) as p
    where exists (select 1 from public.property where id = p and company_id = inv.company_id)
    on conflict do nothing;
  update public.invitation set status = 'accepted', accepted_by = auth.uid(), accepted_at = now() where id = inv.id;
  return inv.company_id;
end $$;

revoke execute on function public.create_company(text, text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_company(text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

create table public.unit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  property_id uuid not null references public.property(id) on delete cascade,
  label text not null,                -- '204', 'Suite 127', 'House'
  kind text not null check (kind in ('residential', 'commercial')),  -- drives application + lease templates
  beds numeric(3,1), baths numeric(3,1), sqft int,
  market_rent_cents int,
  status text not null default 'vacant' check (status in ('occupied', 'vacant', 'notice', 'listed', 'down')),
  created_at timestamptz not null default now(),
  unique (property_id, label)
);

-- ---------- leases and tenant profile ----------
create table public.lease (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  unit_id uuid not null references public.unit(id),
  start_date date not null,
  end_date date,
  term_months int,
  rent_cents int not null,
  short_term_surcharge_cents int not null default 0,   -- SIM REI: +$50/mo under 12 months
  deposit_cents int not null default 0,
  status text not null default 'active' check (status in ('draft', 'pending_signature', 'active', 'notice', 'ended')),
  autopay boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lease_tenant (
  lease_id uuid not null references public.lease(id) on delete cascade,
  contact_id uuid not null references public.contact(id),
  is_primary boolean not null default false,
  company_id uuid not null references public.company(id) on delete cascade,
  primary key (lease_id, contact_id)
);

create table public.emergency_contact (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  tenant_contact_id uuid not null references public.contact(id) on delete cascade,
  name text not null, relationship text, phone text not null,
  updated_source text not null default 'office' check (updated_source in ('office', 'tenant_portal', 'import')),
  updated_at timestamptz not null default now()
);

create table public.vehicle (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  tenant_contact_id uuid not null references public.contact(id) on delete cascade,
  lease_id uuid references public.lease(id),
  make_model text not null,           -- '2019 Toyota Camry'
  color text,
  tag_number text,
  tag_state text default 'FL',
  parking_permit_number text,         -- issued by the office
  updated_source text not null default 'office' check (updated_source in ('office', 'tenant_portal', 'import')),
  updated_at timestamptz not null default now()
);

create table public.renters_insurance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  tenant_contact_id uuid not null references public.contact(id) on delete cascade,
  lease_id uuid references public.lease(id),
  carrier text, policy_number text, expires_on date,
  liability_cents bigint,
  company_is_interested_party boolean not null default false,
  document_id uuid,
  status text not null default 'in_review' check (status in ('in_review', 'active', 'expired', 'rejected')),
  updated_source text not null default 'office' check (updated_source in ('office', 'tenant_portal', 'import')),
  updated_at timestamptz not null default now()
);

-- ---------- accounting (double-entry) ----------
create table public.gl_account (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  number text not null,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'income', 'expense')),
  is_trust boolean not null default false,
  unique (company_id, number)
);

create table public.journal_entry (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  entity_id uuid not null references public.entity(id),
  entry_date date not null,
  memo text not null,
  source text not null default 'manual',       -- manual, rent, payment, bill, bank_feed, reversal, ...
  status text not null default 'draft' check (status in ('draft', 'posted', 'reversed')),
  reversal_of uuid references public.journal_entry(id),
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table public.journal_line (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  journal_entry_id uuid not null references public.journal_entry(id) on delete cascade,
  gl_account_id uuid not null references public.gl_account(id),
  property_id uuid references public.property(id),
  unit_id uuid references public.unit(id),
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  memo text,
  check ((debit_cents = 0) <> (credit_cents = 0))
);

-- Posting requires balanced lines. Posted entries can't be edited, un-posted or deleted:
-- the only allowed change is marking one 'reversed' (after its reversing entry is posted).
-- Only drafts can be deleted, so a company with posted books can't be deleted either.
create or replace function public.journal_entry_guard() returns trigger
language plpgsql as $$
declare d bigint; c bigint;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Posted or reversed journal entries cannot be deleted. Reverse instead.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'reversed' then
    raise exception 'Reversed journal entries cannot be changed.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'posted' then
    if new.status <> 'reversed' or (to_jsonb(new) - 'status') <> (to_jsonb(old) - 'status') then
      raise exception 'Posted journal entries cannot be changed. Reverse instead.';
    end if;
    return new;
  end if;
  if new.status = 'reversed' then
    raise exception 'Only a posted journal entry can be marked reversed.';
  end if;
  if new.status = 'posted' then
    select coalesce(sum(debit_cents),0), coalesce(sum(credit_cents),0) into d, c
      from public.journal_line where journal_entry_id = new.id;
    if d = 0 or d <> c then
      raise exception 'Journal entry is out of balance (debits % vs credits %)', d, c;
    end if;
    new.posted_at = coalesce(new.posted_at, now());
  end if;
  return new;
end $$;
create trigger journal_entry_guard before insert or update or delete on public.journal_entry
  for each row execute function public.journal_entry_guard();

create or replace function public.journal_line_guard() returns trigger
language plpgsql as $$
declare st text;
begin
  select status into st from public.journal_entry where id = coalesce(new.journal_entry_id, old.journal_entry_id);
  if st = 'posted' or st = 'reversed' then
    raise exception 'Lines of a posted or reversed entry cannot be changed.';
  end if;
  return coalesce(new, old);
end $$;
create trigger journal_line_guard before insert or update or delete on public.journal_line
  for each row execute function public.journal_line_guard();

create table public.charge (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  lease_id uuid not null references public.lease(id),
  charge_type text not null,          -- rent, late_fee, pet_rent, pet_fee, nsf_fee, false_emergency, move_out, utility, other
  description text not null,
  amount_cents int not null check (amount_cents > 0),
  due_date date not null,
  journal_entry_id uuid references public.journal_entry(id),
  created_at timestamptz not null default now()
);

create table public.payment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  lease_id uuid not null references public.lease(id),
  method text not null check (method in ('ach', 'card', 'check', 'cash', 'money_order', 'other')),
  amount_cents int not null check (amount_cents > 0),
  fee_cents int not null default 0,   -- card convenience fee paid by tenant
  received_on date not null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'returned', 'failed')),
  processor_ref text,
  journal_entry_id uuid references public.journal_entry(id),
  created_at timestamptz not null default now()
);

-- ---------- vendors and maintenance ----------
create table public.vendor (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  contact_id uuid not null references public.contact(id),
  trade text,
  w9_on_file boolean not null default false,
  coi_expires_on date,
  is_1099 boolean not null default true,
  is_in_house boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.work_order (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  number int not null,                -- per company, starting at 1 (set by trigger)
  unit_id uuid references public.unit(id),
  property_id uuid not null references public.property(id),
  reported_by_contact_id uuid references public.contact(id),
  source text not null default 'portal' check (source in ('portal', 'phone', 'email', 'staff', 'recurring', 'inspection')),
  title text not null,
  triage_category text, triage_item text, triage_symptom text,   -- ids from docs/03-maintenance-triage.json
  triage_answers jsonb not null default '{}'::jsonb,
  priority text not null default 'routine' check (priority in ('routine', 'urgent', 'emergency')),
  emergency_ack jsonb,                -- {text, fee_cents, accepted_at, answers} when the tenant accepted the false-emergency terms
  room text, entry_ok boolean, pets_in_home boolean, tenant_note text,
  ai_summary text,
  self_resolved boolean not null default false,
  vendor_id uuid references public.vendor(id),
  scheduled_start timestamptz, scheduled_end timestamptz,
  tech_arrived_at timestamptz,        -- vendor checks in on site (emergency response time metric)
  status text not null default 'new' check (status in ('new', 'assigned', 'scheduled', 'completed', 'canceled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);

-- Work order numbers count up per company. Security definer so a portal user's insert sees every row.
create or replace function public.work_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext('work_order_number:' || new.company_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.work_order where company_id = new.company_id;
  end if;
  return new;
end $$;
create trigger work_order_number before insert on public.work_order
  for each row execute function public.work_order_number();

create table public.work_order_event (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  work_order_id uuid not null references public.work_order(id) on delete cascade,
  kind text not null,                 -- created, assigned, notified, accepted, scheduled, completed, note
  detail jsonb not null default '{}'::jsonb,
  actor_profile_id uuid references public.profile(id),
  created_at timestamptz not null default now()
);

-- ---------- documents, messages ----------
create table public.document (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  category text not null default 'other',   -- lease, application, inspection, notice, statement, insurance, photo, invoice, other
  source text,                         -- e-sign, communications, tenant portal, upload, move-out, ...
  contact_id uuid references public.contact(id),
  lease_id uuid references public.lease(id),
  property_id uuid references public.property(id),
  work_order_id uuid references public.work_order(id),
  uploaded_by uuid references public.profile(id),
  created_at timestamptz not null default now()
);

create table public.message (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  thread_key text not null,           -- e.g. contact:<id>
  contact_id uuid references public.contact(id),
  channel text not null check (channel in ('email', 'sms', 'portal', 'chat', 'letter')),
  direction text not null check (direction in ('outbound', 'inbound')),
  sender_membership_id uuid references public.membership(id),
  sender_name text, sender_title text,
  body text not null,
  status text not null default 'queued',   -- queued, sent, delivered, opened, failed, received, simulated
  provider_ref text,
  created_at timestamptz not null default now()
);

-- ---------- AI ----------
create table public.ai_connection (
  company_id uuid primary key references public.company(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'google', 'openai_compatible')),
  model text not null,
  base_url text,
  vault_secret_id uuid,               -- key stored in Supabase Vault, never in this table
  key_hint text,                      -- e.g. 'sk-ant…a1b2'
  monthly_limit_cents int not null default 10000,
  status text not null default 'untested' check (status in ('untested', 'ok', 'error', 'paused_limit')),
  tested_at timestamptz
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.company(id) on delete cascade,
  feature text not null,
  input_tokens int, output_tokens int,
  cost_estimate_cents int,
  created_at timestamptz not null default now()
);

create table public.approval_item (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  agent text not null,
  title text not null,
  reasoning text,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references public.profile(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- reports and metrics ----------
create table public.scheduled_report (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  report_key text not null,           -- library id or saved_report id or 'metrics_summary'
  scope jsonb not null default '{"properties":"all"}'::jsonb,
  frequency text not null,            -- daily, weekly_mon, monthly_1, monthly_5, monthly_10, quarterly
  format text not null check (format in ('pdf', 'xlsx', 'csv')),
  recipients jsonb not null,          -- [{type:'member'|'contact'|'email', id|email}]
  active boolean not null default true,
  next_send_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.metric_target (
  company_id uuid not null references public.company(id) on delete cascade,
  metric_key text not null,
  target numeric not null,
  alert boolean not null default true,
  primary key (company_id, metric_key)
);

create table public.metric_snapshot (
  company_id uuid not null references public.company(id) on delete cascade,
  metric_key text not null,
  scope_key text not null default 'portfolio',   -- 'portfolio' or 'property:<id>'
  on_date date not null,
  value numeric not null,
  primary key (company_id, metric_key, scope_key, on_date)
);

-- ---------- audit ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.company(id) on delete cascade,
  actor_profile_id uuid,
  actor_kind text not null default 'user',   -- user, portal, agent, system, api
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb, after jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (company_id, actor_profile_id, table_name, row_id, action, before, after)
  values (coalesce(new.company_id, old.company_id), auth.uid(), tg_table_name,
          coalesce(new.id, old.id)::text, lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- ---------- updated_at, audit triggers, RLS ----------
do $$
declare t text;
begin
  foreach t in array array['company','contact','property','lease','work_order'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
  foreach t in array array['contact','entity','property','property_owner','unit','lease','emergency_contact','vehicle','renters_insurance','gl_account','journal_entry','charge','payment','vendor','work_order','document','scheduled_report','invitation'] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

alter table public.company enable row level security;
alter table public.profile enable row level security;
alter table public.membership enable row level security;

create policy company_select on public.company for select using (public.is_member(id));
create policy company_update on public.company for update using (public.has_role(id, array['admin']::public.member_role[]));
create policy profile_self on public.profile for all using (id = auth.uid()) with check (id = auth.uid());
create policy profile_teammates on public.profile for select using (public.shares_company(id));
create policy membership_select on public.membership for select using (public.is_member(company_id));
create policy membership_admin on public.membership for all using (public.has_role(company_id, array['admin']::public.member_role[]))
  with check (public.has_role(company_id, array['admin']::public.member_role[]));

-- Staff access to every company-scoped table. Narrow by role/property and add portal policies in later migrations.
do $$
declare t text;
begin
  foreach t in array array['contact','entity','property','property_owner','unit','lease','lease_tenant','emergency_contact','vehicle','renters_insurance','gl_account','journal_entry','journal_line','charge','payment','vendor','work_order','work_order_event','document','message','ai_usage','approval_item','scheduled_report','metric_target','metric_snapshot'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_member_all on public.%I for all using (public.is_member(company_id)) with check (public.is_member(company_id))', t, t);
  end loop;
end $$;

alter table public.membership_property enable row level security;
create policy membership_property_member on public.membership_property for all
  using (exists (select 1 from public.membership m where m.id = membership_id and public.is_member(m.company_id)))
  with check (exists (select 1 from public.membership m where m.id = membership_id and public.has_role(m.company_id, array['admin']::public.member_role[])));

-- Invites: admins only. Invitees accept through accept_invitation(), not by reading this table.
alter table public.invitation enable row level security;
create policy invitation_admin on public.invitation for all
  using (public.has_role(company_id, array['admin']::public.member_role[]))
  with check (public.has_role(company_id, array['admin']::public.member_role[]));

-- AI connection: admins only; the key itself lives in Vault and is read only by server code.
alter table public.ai_connection enable row level security;
create policy ai_connection_admin on public.ai_connection for all
  using (public.has_role(company_id, array['admin']::public.member_role[]))
  with check (public.has_role(company_id, array['admin']::public.member_role[]));

-- Audit log: members read it; only the audit trigger writes it (users can't insert, edit or delete).
alter table public.audit_log enable row level security;
create policy audit_log_read on public.audit_log for select using (public.is_member(company_id));

-- Helpful indexes
create index on public.unit (company_id, property_id);
create index on public.lease (company_id, unit_id, status);
create index on public.charge (company_id, lease_id, due_date);
create index on public.payment (company_id, lease_id, received_on);
create index on public.journal_line (company_id, journal_entry_id);
create index on public.work_order (company_id, status, priority);
create index on public.message (company_id, thread_key, created_at);
create index on public.document (company_id, contact_id);
