-- A company's own management agreement templates: uploaded (PDF or Word, turned into editable text) or
-- copied from Parcel Manage's Florida agreement and edited. Each template is a list of parts
-- ({id, heading, body, when}); bodies use the same {{merge_fields}} as the built-in agreement
-- (lib/agreement-templates.ts). An agreement uses the built-in agreement when template_id is null.
create table public.agreement_template (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  parts jsonb not null default '[]',
  -- The uploaded original, kept in the documents bucket for reference.
  source_path text,
  source_name text,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.agreement_template (company_id);
alter table public.agreement_template enable row level security;
create policy agreement_template_member_all on public.agreement_template for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger agreement_template_updated_at before update on public.agreement_template for each row execute function public.set_updated_at();
create trigger agreement_template_audit after insert or update or delete on public.agreement_template for each row execute function public.audit_row();

-- Which template an agreement uses, and a frozen copy of its parts once it's sent (so later template edits
-- never change an agreement that's out for signature or signed).
alter table public.management_agreement add column template_id uuid references public.agreement_template(id) on delete set null;
alter table public.management_agreement add column template_name text;
alter table public.management_agreement add column template_parts jsonb;
