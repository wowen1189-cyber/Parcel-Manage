-- Bank accounts and reconciliation. Each owner's operating and trust accounts map to a cash account in
-- its books (1000 operating, 1010 security deposit trust). Bank transactions come from statement CSVs (or a
-- bank feed later); each is matched to a journal line. A reconciliation proves the cleared book balance
-- equals the statement balance ($0.00 difference). Posted lines are never edited; clearing is tracked here.
create table public.bank_account (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  entity_id uuid not null references public.entity(id),
  name text not null,
  institution text,
  last4 text,
  gl_number text not null default '1000' check (gl_number in ('1000', '1010')),
  created_at timestamptz not null default now(),
  unique (entity_id, gl_number, last4)
);
create table public.bank_transaction (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  bank_account_id uuid not null references public.bank_account(id) on delete cascade,
  posted_on date not null,
  description text not null,
  amount_cents bigint not null,          -- deposits positive, withdrawals negative
  fingerprint text not null,             -- date|amount|description, so re-importing a statement skips duplicates
  journal_line_id uuid references public.journal_line(id),
  status text not null default 'unmatched' check (status in ('unmatched', 'matched', 'ignored')),
  created_at timestamptz not null default now(),
  unique (bank_account_id, fingerprint)
);
create table public.reconciliation (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  bank_account_id uuid not null references public.bank_account(id) on delete cascade,
  statement_date date not null,
  statement_balance_cents bigint not null,
  cleared_balance_cents bigint not null,
  completed_by uuid references public.profile(id),
  completed_at timestamptz not null default now(),
  unique (bank_account_id, statement_date)
);
create table public.bank_cleared_line (
  journal_line_id uuid primary key references public.journal_line(id),
  company_id uuid not null references public.company(id) on delete cascade,
  reconciliation_id uuid not null references public.reconciliation(id) on delete cascade
);
create index on public.bank_transaction (bank_account_id, posted_on);
do $$
declare t text;
begin
  foreach t in array array['bank_account', 'bank_transaction', 'reconciliation', 'bank_cleared_line'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_member_all on public.%I for all using (public.is_member(company_id)) with check (public.is_member(company_id))', t, t);
  end loop;
end $$;
create trigger bank_account_audit after insert or update or delete on public.bank_account for each row execute function public.audit_row();
create trigger reconciliation_audit after insert or update or delete on public.reconciliation for each row execute function public.audit_row();
