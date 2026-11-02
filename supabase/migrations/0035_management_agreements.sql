-- Management agreements: the contract between an owner (entity) and the managing company, covering some or
-- all of the owner's properties. Filled in from Parcel Manage (lib/management-agreement.ts), sent through
-- the native e-signature flow with the owner's signer first and the broker last, and filed on the owner.
create table public.management_agreement (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  entity_id uuid not null references public.entity(id) on delete cascade,
  property_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'sent', 'signed', 'ended')),
  start_date date not null,
  end_date date not null,
  terms jsonb not null default '{}',
  owner_signer_name text,
  owner_signer_title text,
  owner_signer_email text,
  signed_at timestamptz,
  ended_on date,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.management_agreement (company_id, entity_id);
alter table public.management_agreement enable row level security;
create policy management_agreement_member_all on public.management_agreement for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger management_agreement_updated_at before update on public.management_agreement for each row execute function public.set_updated_at();
create trigger management_agreement_audit after insert or update or delete on public.management_agreement for each row execute function public.audit_row();

alter table public.signature_request add column management_agreement_id uuid references public.management_agreement(id) on delete set null;
alter table public.signature_signer drop constraint signature_signer_role_check;
alter table public.signature_signer add constraint signature_signer_role_check check (role in ('tenant', 'guarantor', 'agent', 'owner'));
alter table public.document add column entity_id uuid references public.entity(id) on delete set null;
alter table public.document add column management_agreement_id uuid references public.management_agreement(id) on delete set null;
