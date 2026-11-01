-- Work order numbers are always assigned by the database, so the app never has to send one
-- (and can't pick its own). The default only makes the column optional in the generated types.
alter table public.work_order alter column number set default 0;

create or replace function public.work_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('work_order_number:' || new.company_id::text));
  select coalesce(max(number), 0) + 1 into new.number from public.work_order where company_id = new.company_id;
  return new;
end $$;
revoke execute on function public.work_order_number() from public, anon, authenticated;
