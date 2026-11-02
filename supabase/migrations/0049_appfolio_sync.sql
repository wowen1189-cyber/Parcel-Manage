-- Keeping Parcel Manage current with AppFolio until the switch (scripts/sync-appfolio.mts): work orders
-- brought over from AppFolio keep their AppFolio number, so running the sync again never adds them twice.
alter table public.work_order add column appfolio_ref text;
create unique index work_order_appfolio_ref on public.work_order (company_id, appfolio_ref) where appfolio_ref is not null;
alter table public.work_order drop constraint work_order_source_check;
alter table public.work_order add constraint work_order_source_check check (source in ('portal', 'phone', 'email', 'staff', 'recurring', 'inspection', 'api', 'appfolio'));
