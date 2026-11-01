-- CLAUDE.md rule 7: changes to company settings (business rules, profile) and to the team
-- (roles, titles) go in the audit log too.

-- The company row is its own company, so it needs its own audit function (it has no company_id column).
create or replace function public.audit_company() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    return old; -- the company's audit log is deleted with it
  end if;
  insert into public.audit_log (company_id, actor_profile_id, table_name, row_id, action, before, after)
  values (new.id, auth.uid(), tg_table_name, new.id::text, lower(tg_op),
          case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;
revoke execute on function public.audit_company() from public, anon, authenticated;

create trigger company_audit after insert or update on public.company
  for each row execute function public.audit_company();
create trigger membership_audit after insert or update or delete on public.membership
  for each row execute function public.audit_row();
