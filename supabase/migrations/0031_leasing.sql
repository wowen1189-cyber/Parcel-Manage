-- Leasing: listings for vacant units, guest cards (prospects), showings, rental applications with each adult
-- as a member, and screening results. Applicants never sign in: they use private links (only a sha256 hash of
-- each link is stored). Social Security numbers are never stored here; the screening company collects them.
-- Listing photos live in the private documents bucket and are shown through short-lived signed links.
create table public.listing (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  unit_id uuid not null unique references public.unit(id) on delete cascade,
  headline text not null,
  description text not null default '',
  rent_cents int not null check (rent_cents > 0),
  deposit_cents int,
  available_on date,
  pets_allowed boolean not null default true,
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guest_card (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  unit_id uuid references public.unit(id) on delete set null,
  first_name text not null,
  last_name text not null default '',
  email text,
  phone text,
  source text not null default 'other',
  desired_move_in date,
  status text not null default 'new' check (status in ('new', 'contacted', 'showing', 'applied', 'lost')),
  notes text not null default '',
  sms_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.showing (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  guest_card_id uuid not null references public.guest_card(id) on delete cascade,
  unit_id uuid not null references public.unit(id),
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'no_show', 'canceled')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.application (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  unit_id uuid not null references public.unit(id),
  guest_card_id uuid references public.guest_card(id) on delete set null,
  kind text not null check (kind in ('residential', 'commercial')),
  status text not null default 'invited' check (status in ('invited', 'new', 'screening', 'approved', 'declined', 'lease_sent', 'signed', 'withdrawn')),
  rent_cents int not null,
  desired_move_in date,
  answers jsonb not null default '{}',
  fees_due_cents int not null default 0,
  fees_paid_cents int not null default 0,
  payment_ref text,
  admin_fee_refunded_cents int not null default 0,
  recommendation jsonb,
  decision text check (decision in ('approve', 'approve_higher_deposit', 'review', 'decline')),
  deposit_cents int,
  decision_note text,
  decided_by uuid references public.profile(id),
  decided_at timestamptz,
  adverse_action_sent_at timestamptz,
  lease_id uuid references public.lease(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.application_member (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  application_id uuid not null references public.application(id) on delete cascade,
  role text not null default 'applicant' check (role in ('applicant', 'co_applicant', 'guarantor')),
  first_name text not null,
  last_name text not null default '',
  email text,
  phone text,
  monthly_income_cents int not null default 0,
  answers jsonb not null default '{}',
  token_hash text unique,
  status text not null default 'invited' check (status in ('invited', 'applied')),
  invited_at timestamptz not null default now(),
  opened_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.screening_report (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  application_member_id uuid not null unique references public.application_member(id) on delete cascade,
  provider text not null default 'manual',
  credit_score int check (credit_score between 300 and 900),
  eviction_years_ago numeric(4,1),
  owes_landlord boolean not null default false,
  utility_or_car_problems boolean not null default false,
  criminal_records boolean not null default false,
  agency_name text,
  report_ref text,
  received_at timestamptz not null default now(),
  entered_by uuid references public.profile(id)
);

alter table public.listing enable row level security;
alter table public.guest_card enable row level security;
alter table public.showing enable row level security;
alter table public.application enable row level security;
alter table public.application_member enable row level security;
alter table public.screening_report enable row level security;
create policy listing_member_all on public.listing for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy guest_card_member_all on public.guest_card for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy showing_member_all on public.showing for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy application_member_all on public.application for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy application_member_member_all on public.application_member for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy screening_report_member_all on public.screening_report for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger listing_audit after insert or update or delete on public.listing for each row execute function public.audit_row();
create trigger guest_card_audit after insert or update or delete on public.guest_card for each row execute function public.audit_row();
create trigger showing_audit after insert or update or delete on public.showing for each row execute function public.audit_row();
create trigger application_audit after insert or update or delete on public.application for each row execute function public.audit_row();
create trigger application_member_audit after insert or update or delete on public.application_member for each row execute function public.audit_row();
create trigger screening_report_audit after insert or update or delete on public.screening_report for each row execute function public.audit_row();
create index application_company_status on public.application (company_id, status);
create index guest_card_company on public.guest_card (company_id, created_at desc);
