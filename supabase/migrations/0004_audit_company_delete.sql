-- Deleting a whole company failed: its rows are removed along with it, and the audit trigger tried
-- to log each removal against a company that no longer exists. The company's audit log goes with it,
-- so there's nothing to record; skip logging in that case only.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.company where id = old.company_id) then
    return old;
  end if;
  insert into public.audit_log (company_id, actor_profile_id, table_name, row_id, action, before, after)
  values (coalesce(new.company_id, old.company_id), auth.uid(), tg_table_name,
          coalesce(new.id, old.id)::text, lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_row() from public, anon, authenticated;
