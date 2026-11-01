-- Disconnecting AI deletes the stored key from Vault, not just the connection row.
create or replace function public.clear_ai_connection(p_company uuid) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  if not public.has_role(p_company, array['admin']::public.member_role[]) then
    raise exception 'Only an admin can disconnect AI.';
  end if;
  select vault_secret_id into v_id from public.ai_connection where company_id = p_company;
  delete from public.ai_connection where company_id = p_company;
  if v_id is not null then delete from vault.secrets where id = v_id; end if;
end $$;
revoke execute on function public.clear_ai_connection(uuid) from public, anon;
grant execute on function public.clear_ai_connection(uuid) to authenticated;
