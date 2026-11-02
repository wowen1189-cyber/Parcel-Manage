-- Documents brought over from AppFolio (scripts/import-appfolio-docs.mts) include office-only papers (ID copies,
-- payment arrangements, notes). AppFolio didn't say which were shared with tenants, so they're marked office
-- only: staff see them on the lease and property, and the tenant portal never does.
alter table public.document add column office_only boolean not null default false;
drop policy document_portal_read on public.document;
create policy document_portal_read on public.document for select using (
  not office_only and lease_id in (select public.portal_lease_ids()) and category in ('lease', 'notice', 'statement', 'insurance', 'photo', 'other')
);
