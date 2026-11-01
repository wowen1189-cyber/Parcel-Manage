-- Tenant portal access (CLAUDE.md rule 1: portal users see only their own records).
-- A tenant signs in with the e-mail on their tenant record (magic link proves they own it); claim_portal
-- links that contact to their login. Every portal policy below goes through portal_lease_ids(), the leases
-- the signed-in person is a tenant on. Staff policies (is_member) are unchanged.

-- Contacts linked to the signed-in person, and the leases they're a tenant on.
create or replace function public.portal_contact_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.contact where portal_profile_id = auth.uid()
$$;

create or replace function public.portal_lease_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select lt.lease_id from public.lease_tenant lt
  join public.lease l on l.id = lt.lease_id
  where lt.contact_id in (select public.portal_contact_ids()) and lt.role = 'tenant'
    and l.status in ('active', 'notice', 'draft', 'pending_signature', 'ended')
$$;

create or replace function public.portal_unit_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select unit_id from public.lease where id in (select public.portal_lease_ids())
$$;

-- On a company's site: link the signed-in person to their tenant records in that company by verified e-mail.
-- Returns how many leases they can see. Only tenants on current or upcoming leases are linked.
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
  where c.company_id = p_company and c.portal_profile_id is null
    and exists (select 1 from regexp_split_to_table(lower(coalesce(c.email, '')), '\s*[,;]\s*') e where e = v_email)
    and exists (select 1 from public.lease_tenant lt join public.lease l on l.id = lt.lease_id
                where lt.contact_id = c.id and lt.role = 'tenant' and l.status in ('active', 'notice', 'draft', 'pending_signature'));
  select count(*) into v_count from public.portal_lease_ids() x
  join public.lease l on l.id = x where l.company_id = p_company;
  return v_count;
end $$;

revoke execute on function public.portal_contact_ids(), public.portal_lease_ids(), public.portal_unit_ids(), public.claim_portal(uuid) from public, anon;
grant execute on function public.portal_contact_ids(), public.portal_lease_ids(), public.portal_unit_ids(), public.claim_portal(uuid) to authenticated;

-- Read access to their own tenancy.
create policy lease_portal_read on public.lease for select using (id in (select public.portal_lease_ids()));
create policy lease_tenant_portal_read on public.lease_tenant for select using (lease_id in (select public.portal_lease_ids()));
create policy contact_portal_read on public.contact for select using (id in (select lt.contact_id from public.lease_tenant lt where lt.lease_id in (select public.portal_lease_ids())));
create policy contact_portal_update on public.contact for update using (id in (select public.portal_contact_ids())) with check (id in (select public.portal_contact_ids()));
create policy unit_portal_read on public.unit for select using (id in (select public.portal_unit_ids()));
create policy property_portal_read on public.property for select using (id in (select property_id from public.unit where id in (select public.portal_unit_ids())));
create policy charge_portal_read on public.charge for select using (lease_id in (select public.portal_lease_ids()));
create policy payment_portal_read on public.payment for select using (lease_id in (select public.portal_lease_ids()));
create policy recurring_charge_portal_read on public.recurring_charge for select using (lease_id in (select public.portal_lease_ids()));
create policy document_portal_read on public.document for select using (lease_id in (select public.portal_lease_ids()) and category in ('lease', 'notice', 'statement', 'insurance', 'photo', 'other'));

-- Household details they keep up to date (marked as changed in the portal).
create policy pet_portal_all on public.pet for all using (lease_id in (select public.portal_lease_ids())) with check (lease_id in (select public.portal_lease_ids()) and updated_source = 'tenant_portal');
create policy vehicle_portal_all on public.vehicle for all using (lease_id in (select public.portal_lease_ids())) with check (lease_id in (select public.portal_lease_ids()) and tenant_contact_id in (select public.portal_contact_ids()) and updated_source = 'tenant_portal');
create policy emergency_contact_portal_all on public.emergency_contact for all using (tenant_contact_id in (select public.portal_contact_ids())) with check (tenant_contact_id in (select public.portal_contact_ids()) and updated_source = 'tenant_portal');
create policy renters_insurance_portal_read on public.renters_insurance for select using (lease_id in (select public.portal_lease_ids()));
create policy renters_insurance_portal_insert on public.renters_insurance for insert with check (lease_id in (select public.portal_lease_ids()) and tenant_contact_id in (select public.portal_contact_ids()) and updated_source = 'tenant_portal' and status = 'in_review');

-- Maintenance: their unit's requests; they can open new ones for their own unit.
create policy work_order_portal_read on public.work_order for select using (unit_id in (select public.portal_unit_ids()));
create policy work_order_portal_insert on public.work_order for insert
  with check (unit_id in (select public.portal_unit_ids()) and source = 'portal' and reported_by_contact_id in (select public.portal_contact_ids()) and status = 'new');
create policy work_order_event_portal_read on public.work_order_event for select
  using (work_order_id in (select id from public.work_order where unit_id in (select public.portal_unit_ids())) and kind in ('created', 'scheduled', 'completed', 'canceled', 'tenant_message'));
create policy work_order_event_portal_insert on public.work_order_event for insert
  with check (work_order_id in (select id from public.work_order where unit_id in (select public.portal_unit_ids())) and kind in ('created', 'tenant_message') and actor_profile_id = auth.uid());

-- Messages with the office: their own thread.
alter table public.message add column lease_id uuid references public.lease(id) on delete set null;
create index on public.message (company_id, thread_key, created_at);
create policy message_portal_read on public.message for select using (contact_id in (select public.portal_contact_ids()) and channel in ('portal', 'email', 'letter'));
create policy message_portal_insert on public.message for insert
  with check (contact_id in (select public.portal_contact_ids()) and channel = 'portal' and direction = 'inbound' and status = 'received' and sender_membership_id is null);
