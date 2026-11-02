-- Rate limits for public forms (rental inquiries and applications): one row per attempt, keyed by a hash of
-- the visitor's address and the form. Server-only (no policies), cleaned up after a day.
create table public.rate_hit (
  key text not null,
  at timestamptz not null default now()
);
create index rate_hit_key_at on public.rate_hit (key, at);
alter table public.rate_hit enable row level security;
