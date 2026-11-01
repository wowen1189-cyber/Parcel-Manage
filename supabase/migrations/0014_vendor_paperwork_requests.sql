-- Vendor paperwork requests: the office asks a vendor for a W-9 and insurance; the vendor gets an e-mail
-- with a private link to upload them (no account needed) and reminders until everything is in.
create table public.vendor_request (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  vendor_id uuid not null references public.vendor(id) on delete cascade,
  token_hash text not null unique,          -- sha256 of the link token; the token itself is only in the e-mail
  items text[] not null,                    -- w9, coi, workers_comp
  sent_to text not null,
  send_count int not null default 1,
  first_sent_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  opened_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now()
);
create index on public.vendor_request (company_id, vendor_id);
alter table public.vendor_request enable row level security;
create policy vendor_request_member_all on public.vendor_request for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger vendor_request_audit after insert or update or delete on public.vendor_request for each row execute function public.audit_row();

-- Documents can belong to a vendor and carry an expiration (insurance certificates).
alter table public.document
  add column vendor_id uuid references public.vendor(id) on delete cascade,
  add column expires_on date;
create index on public.document (company_id, vendor_id);

-- Private file storage. Only server code (service role) reads and writes; staff get short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;
