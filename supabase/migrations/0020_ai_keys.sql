-- Bring-your-own AI key (CLAUDE.md rule 3): the key is stored encrypted in Supabase Vault, never in a table,
-- never returned to the browser. Admins can set or replace it; only server code (service role) reads it.
create extension if not exists supabase_vault with schema vault;

create or replace function public.set_ai_key(p_company uuid, p_key text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare
  v_id uuid;
begin
  if not public.has_role(p_company, array['admin']::public.member_role[]) then
    raise exception 'Only an admin can change the AI key.';
  end if;
  if length(coalesce(p_key, '')) < 10 then raise exception 'That key looks too short.'; end if;
  select vault_secret_id into v_id from public.ai_connection where company_id = p_company;
  if v_id is not null and exists (select 1 from vault.secrets where id = v_id) then
    perform vault.update_secret(v_id, p_key);
  else
    v_id := vault.create_secret(p_key, 'ai_key_' || p_company::text || '_' || extract(epoch from now())::bigint, 'AI provider key for company ' || p_company::text);
    update public.ai_connection set vault_secret_id = v_id where company_id = p_company;
  end if;
  update public.ai_connection set key_hint = left(p_key, 6) || '…' || right(p_key, 4), status = 'untested' where company_id = p_company;
end $$;
revoke execute on function public.set_ai_key(uuid, text) from public, anon;
grant execute on function public.set_ai_key(uuid, text) to authenticated;

-- Server-only: the decrypted key for one company.
create or replace function public.ai_key_for(p_company uuid) returns text
language sql stable security definer set search_path = public, vault as $$
  select s.decrypted_secret from vault.decrypted_secrets s
  join public.ai_connection c on c.vault_secret_id = s.id
  where c.company_id = p_company
$$;
revoke execute on function public.ai_key_for(uuid) from public, anon, authenticated;
grant execute on function public.ai_key_for(uuid) to service_role;

-- Members can see spend; only server code records usage.
create index on public.ai_usage (company_id, created_at);
