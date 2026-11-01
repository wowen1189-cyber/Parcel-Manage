-- Owner portal: owners (the e-mail on the owner record) and partners (the e-mail on a partner of one of the
-- owner's properties) sign in with a verified e-mail and see only that owner's properties, statements and
-- distributions. Staff policies (is_member) are unchanged.
create or replace function public.owner_entity_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  with me as (select lower(email) as email from auth.users where id = auth.uid() and email_confirmed_at is not null)
  select e.id from public.entity e, me
  where exists (select 1 from regexp_split_to_table(lower(coalesce(e.email, '')), '\s*[,;]\s*') x where x = me.email)
  union
  select p.entity_id from public.property p
  join public.property_owner po on po.property_id = p.id
  join public.contact c on c.id = po.owner_contact_id, me
  where exists (select 1 from regexp_split_to_table(lower(coalesce(c.email, '')), '\s*[,;]\s*') x where x = me.email)
$$;
revoke execute on function public.owner_entity_ids() from public, anon;
grant execute on function public.owner_entity_ids() to authenticated;

create policy entity_owner_read on public.entity for select using (id in (select public.owner_entity_ids()));
create policy property_owner_portal_read on public.property for select using (entity_id in (select public.owner_entity_ids()));
create policy unit_owner_portal_read on public.unit for select using (property_id in (select id from public.property where entity_id in (select public.owner_entity_ids())));
create policy owner_statement_owner_read on public.owner_statement for select using (entity_id in (select public.owner_entity_ids()));
create policy owner_distribution_owner_read on public.owner_distribution for select using (entity_id in (select public.owner_entity_ids()));
