-- 0027's unit policy read property, whose tenant-portal policy reads unit: Postgres sees a policy loop.
-- Look up the owner's properties in a security definer function instead.
create or replace function public.owner_property_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.property where entity_id in (select public.owner_entity_ids())
$$;
revoke execute on function public.owner_property_ids() from public, anon;
grant execute on function public.owner_property_ids() to authenticated;

drop policy if exists unit_owner_portal_read on public.unit;
create policy unit_owner_portal_read on public.unit for select using (property_id in (select public.owner_property_ids()));
drop policy if exists property_owner_portal_read on public.property;
create policy property_owner_portal_read on public.property for select using (id in (select public.owner_property_ids()));
