-- Native e-signature (Florida Electronic Signature Act, ch. 668 incl. the UETA at 668.50; federal E-SIGN).
-- When sent, the filled documents are frozen (snapshot) and hashed, so what's signed can't change. Each
-- signer gets a private link (hash stored), consents to sign electronically, and adopts a typed signature;
-- every step is logged with time, IP address and device. The signed PDF with a certificate is filed.
create table public.signature_request (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  lease_id uuid references public.lease(id) on delete set null,
  title text not null,
  snapshot jsonb not null,               -- DocText[] (lib/documents/text.ts)
  snapshot_sha256 text not null,
  status text not null default 'sent' check (status in ('sent', 'completed', 'voided')),
  signed_document_id uuid references public.document(id) on delete set null,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table public.signature_signer (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  request_id uuid not null references public.signature_request(id) on delete cascade,
  sign_order int not null,
  role text not null check (role in ('tenant', 'guarantor', 'agent')),
  name text not null,
  email text not null,
  token_hash text unique,
  status text not null default 'waiting' check (status in ('waiting', 'sent', 'viewed', 'signed', 'declined')),
  consented_at timestamptz,
  signed_at timestamptz,
  typed_signature text,
  initials text,
  ip text,
  user_agent text
);
create table public.signature_event (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.company(id) on delete cascade,
  request_id uuid not null references public.signature_request(id) on delete cascade,
  signer_id uuid references public.signature_signer(id) on delete set null,
  kind text not null,                    -- created, sent, viewed, consented, signed, declined, completed, voided
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.signature_signer (request_id, sign_order);
create index on public.signature_event (request_id, created_at);
do $$
declare t text;
begin
  foreach t in array array['signature_request', 'signature_signer', 'signature_event'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_member_all on public.%I for all using (public.is_member(company_id)) with check (public.is_member(company_id))', t, t);
  end loop;
end $$;
create trigger signature_request_audit after insert or update or delete on public.signature_request for each row execute function public.audit_row();
