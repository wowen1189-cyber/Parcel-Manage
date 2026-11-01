-- Phase 1 accounting: chart of accounts, posting functions, charges and payments that post balanced
-- journal entries (CLAUDE.md rule 5). Each owner (entity) has its own books: every entry carries entity_id.
-- Security deposits live in trust: payments for deposits debit the trust cash account (is_trust).
-- All functions run as the caller (security invoker), so Row Level Security still applies.

-- What a payment is for: rent and charges, or a security deposit held in trust.
alter table public.payment
  add column purpose text not null default 'rent' check (purpose in ('rent', 'deposit')),
  add column reference text,                       -- check number, money order number, processor id
  add column memo text,
  add column returned_on date,
  add column created_by uuid references public.profile(id);
alter table public.charge add column memo text, add column created_by uuid references public.profile(id);
create index on public.charge (company_id, lease_id, due_date);
create index on public.payment (company_id, lease_id, received_on);
create index on public.journal_entry (company_id, entity_id, entry_date);
create index on public.journal_line (company_id, gl_account_id);

-- Default chart of accounts for a property management company (numbers are stable codes the app uses).
create or replace function public.ensure_chart_of_accounts(p_company uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  insert into public.gl_account (company_id, number, name, type, is_trust)
  select p_company, a.number, a.name, a.type, a.trust
  from (values
    ('1000', 'Operating cash', 'asset', false),
    ('1010', 'Security deposit trust cash', 'asset', true),
    ('1100', 'Accounts receivable: tenants', 'asset', false),
    ('1200', 'Undeposited funds', 'asset', false),
    ('2000', 'Accounts payable', 'liability', false),
    ('2100', 'Security deposits held', 'liability', true),
    ('2200', 'Prepaid rent', 'liability', false),
    ('3000', 'Owner contributions', 'equity', false),
    ('3100', 'Owner distributions', 'equity', false),
    ('3900', 'Opening balance equity', 'equity', false),
    ('4000', 'Rent income', 'income', false),
    ('4010', 'Late fee income', 'income', false),
    ('4020', 'Pet rent and fees', 'income', false),
    ('4030', 'Returned payment fees', 'income', false),
    ('4040', 'Utility reimbursements', 'income', false),
    ('4050', 'CAM income', 'income', false),
    ('4060', 'Damage and move-out charges', 'income', false),
    ('4090', 'Other income', 'income', false),
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

create or replace function public.gl_id(p_company uuid, p_number text) returns uuid
language sql stable security invoker set search_path = public as $$
  select id from public.gl_account where company_id = p_company and number = p_number
$$;

-- Post one balanced entry in a single call. p_lines: [{"account":"1100","debit":12345,"credit":0,"property_id":..,"unit_id":..,"memo":..}]
create or replace function public.post_journal_entry(p_company uuid, p_entity uuid, p_date date, p_memo text, p_source text, p_lines jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_entry uuid;
  l jsonb;
  v_account uuid;
begin
  perform public.ensure_chart_of_accounts(p_company);
  insert into public.journal_entry (company_id, entity_id, entry_date, memo, source, status, created_by)
  values (p_company, p_entity, p_date, p_memo, p_source, 'draft', auth.uid())
  returning id into v_entry;
  for l in select * from jsonb_array_elements(p_lines) loop
    v_account := coalesce((l->>'account_id')::uuid, public.gl_id(p_company, l->>'account'));
    if v_account is null then raise exception 'Unknown account %', coalesce(l->>'account', l->>'account_id'); end if;
    insert into public.journal_line (company_id, journal_entry_id, gl_account_id, property_id, unit_id, debit_cents, credit_cents, memo)
    values (p_company, v_entry, v_account, nullif(l->>'property_id', '')::uuid, nullif(l->>'unit_id', '')::uuid,
            coalesce((l->>'debit')::bigint, 0), coalesce((l->>'credit')::bigint, 0), l->>'memo');
  end loop;
  update public.journal_entry set status = 'posted' where id = v_entry;   -- the guard checks the balance
  return v_entry;
end $$;

-- Reverse a posted entry: a new entry with debits and credits swapped, then the original is marked reversed.
create or replace function public.reverse_journal_entry(p_entry uuid, p_date date, p_memo text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  e public.journal_entry;
  v_new uuid;
begin
  select * into e from public.journal_entry where id = p_entry;
  if e.id is null then raise exception 'Journal entry not found'; end if;
  if e.status <> 'posted' then raise exception 'Only a posted entry can be reversed.'; end if;
  insert into public.journal_entry (company_id, entity_id, entry_date, memo, source, status, reversal_of, created_by)
  values (e.company_id, e.entity_id, p_date, p_memo, 'reversal', 'draft', e.id, auth.uid())
  returning id into v_new;
  insert into public.journal_line (company_id, journal_entry_id, gl_account_id, property_id, unit_id, debit_cents, credit_cents, memo)
  select company_id, v_new, gl_account_id, property_id, unit_id, credit_cents, debit_cents, memo
  from public.journal_line where journal_entry_id = e.id;
  update public.journal_entry set status = 'posted' where id = v_new;
  update public.journal_entry set status = 'reversed' where id = e.id;
  return v_new;
end $$;

-- Income account for each charge type.
create or replace function public.charge_income_account(p_type text) returns text
language sql immutable as $$
  select case p_type
    when 'rent' then '4000' when 'late_fee' then '4010' when 'pet_rent' then '4020' when 'pet_fee' then '4020'
    when 'nsf_fee' then '4030' when 'utility' then '4040' when 'cam' then '4050'
    when 'move_out' then '4060' when 'false_emergency' then '4060' when 'opening_balance' then '3900'
    else '4090' end
$$;

-- A charge on a tenant's ledger: debit receivable, credit income, for the lease's property and owner.
create or replace function public.post_charge(p_lease uuid, p_type text, p_description text, p_amount int, p_due date, p_memo text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v record;
  v_entry uuid;
  v_charge uuid;
begin
  if p_amount <= 0 then raise exception 'A charge must be more than $0.'; end if;
  select l.company_id, l.unit_id, u.property_id, p.entity_id into v
  from public.lease l join public.unit u on u.id = l.unit_id join public.property p on p.id = u.property_id
  where l.id = p_lease;
  if v.company_id is null then raise exception 'Lease not found'; end if;
  v_entry := public.post_journal_entry(v.company_id, v.entity_id, p_due, p_description, 'charge', jsonb_build_array(
    jsonb_build_object('account', '1100', 'debit', p_amount, 'property_id', v.property_id, 'unit_id', v.unit_id, 'memo', p_description),
    jsonb_build_object('account', public.charge_income_account(p_type), 'credit', p_amount, 'property_id', v.property_id, 'unit_id', v.unit_id, 'memo', p_description)
  ));
  insert into public.charge (company_id, lease_id, charge_type, description, amount_cents, due_date, journal_entry_id, memo, created_by)
  values (v.company_id, p_lease, p_type, p_description, p_amount, p_due, v_entry, p_memo, auth.uid())
  returning id into v_charge;
  return v_charge;
end $$;

-- A payment: rent payments debit cash and credit the receivable; deposit payments go to trust
-- (debit trust cash, credit deposits held).
create or replace function public.record_payment(p_lease uuid, p_method text, p_amount int, p_received date, p_purpose text default 'rent', p_reference text default null, p_memo text default null, p_status text default 'succeeded')
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v record;
  v_entry uuid;
  v_payment uuid;
  v_desc text;
begin
  if p_amount <= 0 then raise exception 'A payment must be more than $0.'; end if;
  select l.company_id, l.unit_id, u.property_id, p.entity_id into v
  from public.lease l join public.unit u on u.id = l.unit_id join public.property p on p.id = u.property_id
  where l.id = p_lease;
  if v.company_id is null then raise exception 'Lease not found'; end if;
  v_desc := case when p_purpose = 'deposit' then 'Security deposit received' else 'Payment received' end || coalesce(' (' || p_reference || ')', '');
  if p_status = 'succeeded' then
    v_entry := public.post_journal_entry(v.company_id, v.entity_id, p_received, v_desc, 'payment', case when p_purpose = 'deposit' then jsonb_build_array(
      jsonb_build_object('account', '1010', 'debit', p_amount, 'property_id', v.property_id, 'unit_id', v.unit_id),
      jsonb_build_object('account', '2100', 'credit', p_amount, 'property_id', v.property_id, 'unit_id', v.unit_id)
    ) else jsonb_build_array(
      jsonb_build_object('account', '1000', 'debit', p_amount, 'property_id', v.property_id, 'unit_id', v.unit_id),
      jsonb_build_object('account', '1100', 'credit', p_amount, 'property_id', v.property_id, 'unit_id', v.unit_id)
    ) end);
  end if;
  insert into public.payment (company_id, lease_id, method, amount_cents, received_on, status, purpose, reference, memo, journal_entry_id, created_by)
  values (v.company_id, p_lease, p_method, p_amount, p_received, p_status, p_purpose, p_reference, p_memo, v_entry, auth.uid())
  returning id into v_payment;
  return v_payment;
end $$;

-- A payment came back (bounced check, returned ACH): reverse its entry, mark it returned, and charge the
-- lease's returned-payment fee if it has one (the fee must be in the lease; Fla. Stat. 83.43 / 68.065).
create or replace function public.return_payment(p_payment uuid, p_date date, p_fee int default 0)
returns void language plpgsql security invoker set search_path = public as $$
declare
  pay public.payment;
begin
  select * into pay from public.payment where id = p_payment;
  if pay.id is null then raise exception 'Payment not found'; end if;
  if pay.status <> 'succeeded' then raise exception 'Only a completed payment can be returned.'; end if;
  if pay.journal_entry_id is not null then
    perform public.reverse_journal_entry(pay.journal_entry_id, p_date, 'Returned payment' || coalesce(' (' || pay.reference || ')', ''));
  end if;
  update public.payment set status = 'returned', returned_on = p_date where id = pay.id;
  if p_fee > 0 then
    perform public.post_charge(pay.lease_id, 'nsf_fee', 'Returned payment fee', p_fee, p_date);
  end if;
end $$;

grant execute on function public.ensure_chart_of_accounts(uuid), public.gl_id(uuid, text), public.post_journal_entry(uuid, uuid, date, text, text, jsonb),
  public.reverse_journal_entry(uuid, date, text), public.charge_income_account(text), public.post_charge(uuid, text, text, int, date, text),
  public.record_payment(uuid, text, int, date, text, text, text, text), public.return_payment(uuid, date, int) to authenticated, service_role;

-- Every company gets its chart of accounts now.
select public.ensure_chart_of_accounts(id) from public.company;
