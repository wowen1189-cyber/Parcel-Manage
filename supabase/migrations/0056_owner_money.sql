-- How each owner's money works, the management company's own books, and billing out management fees
-- (Wesley Owen, Nov 2, 2026; docs/02-business-rules.md "Owner money").
--
-- entity.books_mode:
--   managed    the company holds the owner's money in the owner's operating account and pays out
--              distributions after fees, bills and reserve (partnerships, third-party owners).
--   own_books  the owner's money lands in the owner's own bank and stays there: no distributions;
--              money taken out is an owner draw, money put in an owner contribution.
-- entity.is_manager marks the management company's own books (one per company). It owns no properties and
-- receives the management, leasing and renewal fees it bills owners (fee_invoice).

alter table public.entity
  add column books_mode text not null default 'managed' check (books_mode in ('managed', 'own_books')),
  add column is_manager boolean not null default false;
create unique index entity_one_manager on public.entity (company_id) where is_manager;

create or replace function public.ensure_chart_of_accounts(p_company uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  insert into public.gl_account (company_id, number, name, type, is_trust)
  select p_company, a.number, a.name, a.type, a.trust
  from (values
    ('1000', 'Operating cash', 'asset', false),
    ('1010', 'Security deposit trust cash', 'asset', true),
    ('1100', 'Accounts receivable: tenants', 'asset', false),
    ('1150', 'Fees receivable from owners', 'asset', false),
    ('1200', 'Undeposited funds', 'asset', false),
    ('2000', 'Accounts payable', 'liability', false),
    ('2050', 'Due to management company', 'liability', false),
    ('2100', 'Security deposits held', 'liability', true),
    ('2200', 'Prepaid rent', 'liability', false),
    ('2500', 'Loans payable', 'liability', false),
    ('3000', 'Owner contributions', 'equity', false),
    ('3100', 'Owner distributions and draws', 'equity', false),
    ('3900', 'Opening balance equity', 'equity', false),
    ('4000', 'Rent income', 'income', false),
    ('4010', 'Late fee income', 'income', false),
    ('4020', 'Pet rent and fees', 'income', false),
    ('4030', 'Returned payment fees', 'income', false),
    ('4040', 'Utility reimbursements', 'income', false),
    ('4050', 'CAM income', 'income', false),
    ('4060', 'Damage and move-out charges', 'income', false),
    ('4090', 'Other income', 'income', false),
    ('4100', 'Management fee income', 'income', false),
    ('4110', 'Leasing fee income', 'income', false),
    ('4120', 'Renewal fee income', 'income', false),
    ('5000', 'Repairs and maintenance', 'expense', false),
    ('5100', 'Management fees', 'expense', false),
    ('5110', 'Leasing and renewal fees', 'expense', false),
    ('5200', 'Utilities', 'expense', false),
    ('5300', 'Insurance', 'expense', false),
    ('5400', 'Property taxes', 'expense', false),
    ('5500', 'Mortgage interest', 'expense', false),
    ('5900', 'Other expenses', 'expense', false)
  ) as a(number, name, type, trust)
  on conflict (company_id, number) do nothing;
end $$;
update public.gl_account set name = 'Owner distributions and draws' where number = '3100' and name = 'Owner distributions';
select public.ensure_chart_of_accounts(id) from public.company;

-- A management fee bill from the management company to one owner for one month. Draft until a person
-- approves it (money, CLAUDE.md rule 4); approving posts the fee on both sets of books, paying moves the cash.
create table public.fee_invoice (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  number int not null,
  owner_entity_id uuid not null references public.entity(id),
  manager_entity_id uuid not null references public.entity(id),
  period_start date not null,
  period_end date not null,
  lines jsonb not null,                  -- lib/fee-billing.ts FeeLine[]
  total_cents int not null check (total_cents >= 0),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'void')),
  approved_by uuid references public.profile(id),
  approved_at timestamptz,
  owner_entry_id uuid references public.journal_entry(id),
  manager_entry_id uuid references public.journal_entry(id),
  paid_on date,
  method text,
  reference text,
  owner_payment_entry_id uuid references public.journal_entry(id),
  manager_payment_entry_id uuid references public.journal_entry(id),
  sent_at timestamptz,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  unique (company_id, number)
);
-- One live bill per owner and month (a voided one can be replaced).
create unique index fee_invoice_owner_month on public.fee_invoice (owner_entity_id, period_start) where status <> 'void';
create index on public.fee_invoice (company_id, period_start);
alter table public.fee_invoice enable row level security;
create policy fee_invoice_member_all on public.fee_invoice for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger fee_invoice_audit after insert or update or delete on public.fee_invoice for each row execute function public.audit_row();
