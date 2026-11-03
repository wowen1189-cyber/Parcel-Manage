-- Sharing documents with tenants and owners (Wesley Owen, Nov 2, 2026). The office chooses, file by file, what a
-- tenant sees in the resident portal (office_only = false) and what an owner sees in the owner portal
-- (shared_with_owner). Leases, including renewals, are shared with both by default; everything else starts
-- office only unless it was already visible to tenants.

alter table public.document add column shared_with_owner boolean not null default false;

-- The office decides now, not the document type. Keep what tenants couldn't see before hidden.
update public.document set office_only = true
where not office_only and category not in ('lease', 'notice', 'statement', 'insurance', 'photo', 'other');

-- Leases and renewals: shared with the tenant and the owner (not internal papers like a broker commission).
update public.document set office_only = false, shared_with_owner = true
where category = 'lease' and file_name !~* 'commission';

create or replace function public.document_sharing_defaults() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.category = 'lease' and new.file_name !~* 'commission' then
    new.office_only := false;
    new.shared_with_owner := true;
  elsif new.category in ('application', 'invoice', 'inspection') then
    -- Screening papers, vendor invoices and inspection files stay with the office unless someone shares them.
    new.office_only := true;
  end if;
  return new;
end $$;
create trigger document_sharing_defaults before insert on public.document
  for each row execute function public.document_sharing_defaults();

drop policy document_portal_read on public.document;
create policy document_portal_read on public.document for select using (
  not office_only and lease_id in (select public.portal_lease_ids())
);

create policy document_owner_read on public.document for select using (
  shared_with_owner and (
    entity_id in (select public.owner_entity_ids())
    or property_id in (select public.owner_property_ids())
    or lease_id in (select l.id from public.lease l join public.unit u on u.id = l.unit_id where u.property_id in (select public.owner_property_ids()))
  )
);
