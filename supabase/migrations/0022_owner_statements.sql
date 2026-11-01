-- Owner statements and distributions (monthly close per owner). Closing a month posts the management,
-- leasing and renewal fees to the owner's books, saves the statement, and lists what each owner or
-- partner is due after expenses, unpaid bills and the cash reserve, split by ownership percent.

alter table public.entity add column reserve_cents int not null default 0 check (reserve_cents >= 0);

create table public.owner_statement (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  entity_id uuid not null references public.entity(id),
  period_start date not null,
  period_end date not null,
  totals jsonb not null,                 -- lib/owner-statements.ts StatementTotals
  lines jsonb not null default '[]',     -- per-property detail
  fee_entry_ids uuid[] not null default '{}',
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (entity_id, period_start)
);
create index on public.owner_statement (company_id, period_start);

create table public.owner_distribution (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  statement_id uuid not null references public.owner_statement(id) on delete cascade,
  entity_id uuid not null references public.entity(id),
  payee_contact_id uuid references public.contact(id),   -- a partner; null = the owner itself
  payee_name text not null,
  ownership_pct numeric(6,3) not null,
  amount_cents int not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'held')),
  method text,
  reference text,
  paid_on date,
  journal_entry_id uuid references public.journal_entry(id),
  created_at timestamptz not null default now()
);
create index on public.owner_distribution (company_id, status);

do $$
declare t text;
begin
  foreach t in array array['owner_statement', 'owner_distribution'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_member_all on public.%I for all using (public.is_member(company_id)) with check (public.is_member(company_id))', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;
