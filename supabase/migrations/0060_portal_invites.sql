-- Portal invitations (Wesley Owen, Nov 3, 2026). Nobody gets into a portal until the office invites them:
-- a tenant needs an invite before their login links to their lease, and an owner or partner needs one before
-- the owner portal shows them anything. Inviting is one at a time or in bulk; the date is kept for each person.

alter table public.contact add column portal_invited_at timestamptz;        -- tenant portal
alter table public.contact add column owner_portal_invited_at timestamptz;  -- owner portal, as a property partner
alter table public.entity add column portal_invited_at timestamptz;         -- owner portal, the owner record's e-mail

-- Tenants already using the portal keep it.
update public.contact set portal_invited_at = now() where portal_profile_id is not null and portal_invited_at is null;

create or replace function public.claim_portal(p_company uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_count int;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  update public.contact c set portal_profile_id = auth.uid()
  where c.company_id = p_company and c.portal_profile_id is null and c.portal_invited_at is not null
    and exists (select 1 from regexp_split_to_table(lower(coalesce(c.email, '')), '\s*[,;]\s*') e where e = v_email)
    and exists (select 1 from public.lease_tenant lt join public.lease l on l.id = lt.lease_id
                where lt.contact_id = c.id and lt.role = 'tenant' and l.status in ('active', 'notice', 'draft', 'pending_signature'));
  select count(*) into v_count from public.portal_lease_ids() x
  join public.lease l on l.id = x where l.company_id = p_company;
  return v_count;
end $$;

create or replace function public.owner_entity_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  with me as (select lower(email) as email from auth.users where id = auth.uid() and email_confirmed_at is not null)
  select e.id from public.entity e, me
  where e.portal_invited_at is not null
    and exists (select 1 from regexp_split_to_table(lower(coalesce(e.email, '')), '\s*[,;]\s*') x where x = me.email)
  union
  select p.entity_id from public.property p
  join public.property_owner po on po.property_id = p.id
  join public.contact c on c.id = po.owner_contact_id, me
  where c.owner_portal_invited_at is not null
    and exists (select 1 from regexp_split_to_table(lower(coalesce(c.email, '')), '\s*[,;]\s*') x where x = me.email)
$$;
