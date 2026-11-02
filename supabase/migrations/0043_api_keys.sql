-- API keys for the public REST API (/api/v1) and the MCP server (/api/mcp). The key itself is shown once
-- when it's made; only its SHA-256 is kept. Scopes: 'read' (everything the API lists) and
-- 'write:work_orders' (create work orders). Admins make and revoke keys (app/(manager)/settings/api).
create table public.api_key (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  prefix text not null,                 -- first characters, so people can tell keys apart
  key_hash text not null unique,
  scopes text[] not null default '{read}' check (scopes <@ array['read', 'write:work_orders']::text[] and cardinality(scopes) > 0),
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index on public.api_key (company_id);
alter table public.api_key enable row level security;
create policy api_key_member_all on public.api_key for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger api_key_audit after insert or update or delete on public.api_key for each row execute function public.audit_row();
