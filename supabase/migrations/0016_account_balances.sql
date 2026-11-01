-- Account balances for one owner's books over a date range (trial balance, income statement).
-- Posted and reversed entries both count: a reversal is its own entry, so the pair nets to zero.
create or replace function public.account_balances(p_company uuid, p_entity uuid, p_from date, p_to date)
returns table (account_id uuid, number text, name text, type text, is_trust boolean, debit_cents bigint, credit_cents bigint)
language sql stable security invoker set search_path = public as $$
  select a.id, a.number, a.name, a.type, a.is_trust,
         coalesce(sum(l.debit_cents), 0)::bigint, coalesce(sum(l.credit_cents), 0)::bigint
  from public.gl_account a
  left join public.journal_line l on l.gl_account_id = a.id
    and exists (select 1 from public.journal_entry e where e.id = l.journal_entry_id and e.status in ('posted', 'reversed')
                and (p_entity is null or e.entity_id = p_entity)
                and (p_from is null or e.entry_date >= p_from) and e.entry_date <= p_to)
  where a.company_id = p_company
  group by a.id, a.number, a.name, a.type, a.is_trust
  order by a.number
$$;
grant execute on function public.account_balances(uuid, uuid, date, date) to authenticated, service_role;
