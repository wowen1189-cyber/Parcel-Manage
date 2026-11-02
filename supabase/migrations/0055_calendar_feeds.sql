-- Self-serve calendar connection (lib/ical.ts). Each person can:
--   * subscribe to Parcel Manage's dates from Google Calendar (or Outlook/Apple) with a private link; only a hash
--     of the link's token is stored, and a new link replaces the old one;
--   * add their own calendars' secret iCal addresses, so their events show next to Parcel Manage's and
--     double-booked showings are flagged. Those addresses are private: only the person who added one sees it.
create table public.calendar_feed (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  profile_id uuid not null references public.profile(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique (company_id, profile_id)
);
alter table public.calendar_feed enable row level security;
create policy calendar_feed_own on public.calendar_feed for all using (profile_id = auth.uid() and public.is_member(company_id)) with check (profile_id = auth.uid() and public.is_member(company_id));

create table public.external_calendar (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  profile_id uuid not null references public.profile(id) on delete cascade,
  name text not null,
  ics_url text not null,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index external_calendar_owner on public.external_calendar (company_id, profile_id);
alter table public.external_calendar enable row level security;
create policy external_calendar_own on public.external_calendar for all using (profile_id = auth.uid() and public.is_member(company_id)) with check (profile_id = auth.uid() and public.is_member(company_id));
