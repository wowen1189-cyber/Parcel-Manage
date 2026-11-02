-- Undo also checks what points at imported vendors (work orders, bills, recurring schedules), not only
-- at their contact records (0041).
create or replace function public.undo_import(p_batch uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare
  b public.import_batch;
  c jsonb;
  sets jsonb;
  t record;
  fk record;
  n int;
  extra text;
begin
  select * into b from public.import_batch where id = p_batch for update;
  if b.id is null then raise exception 'Import not found.'; end if;
  if b.undone_at is not null then raise exception 'This import was already undone.'; end if;
  if b.created_at < now() - interval '30 days' then raise exception 'Imports can only be undone for 30 days.'; end if;
  c := b.created;
  sets := jsonb_build_object('lease', coalesce(c->'lease', '[]'), 'unit', coalesce(c->'unit', '[]'), 'property', coalesce(c->'property', '[]'),
    'contact', coalesce(c->'contact', '[]') || coalesce(c->'vendor_contact', '[]'), 'entity', coalesce(c->'entity', '[]'),
    'vendor', to_jsonb(array(select id::text from public.vendor where contact_id = any(public.import_ids(c, 'vendor_contact')))));
  -- Anything outside this import that points at what it created blocks the undo.
  for t in select key as tbl from jsonb_each(sets) where jsonb_array_length(value) > 0 loop
    for fk in
      select conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
      where k.contype = 'f' and k.confrelid = ('public.' || t.tbl)::regclass
    loop
      extra := case
        when fk.tbl in ('lease', 'unit', 'property', 'contact', 'entity') then format(' and not (id = any(%L::uuid[]))', public.import_ids(sets, fk.tbl))
        when fk.tbl = 'lease_tenant' then format(' and not (lease_id = any(%L::uuid[]))', public.import_ids(sets, 'lease'))
        when fk.tbl = 'vendor' and fk.col = 'contact_id' then format(' and not (contact_id = any(%L::uuid[]))', public.import_ids(c, 'vendor_contact'))
        when fk.tbl in ('import_batch', 'audit_log') then ' and false'
        else '' end;
      execute format('select count(*) from %s where %I = any($1)%s', fk.tbl, fk.col, extra) into n using public.import_ids(sets, t.tbl);
      if n > 0 then raise exception 'Records from this import are in use now (% in %). Nothing was undone.', n, fk.tbl; end if;
    end loop;
  end loop;
  update public.property p set entity_id = (m->>'from')::uuid
    from jsonb_array_elements(coalesce(c->'moved', '[]')) m
    where p.id = (m->>'id')::uuid and p.entity_id = (m->>'to')::uuid;
  delete from public.lease_tenant where lease_id = any(public.import_ids(c, 'lease'));
  delete from public.lease where id = any(public.import_ids(c, 'lease'));
  delete from public.unit where id = any(public.import_ids(c, 'unit'));
  delete from public.property where id = any(public.import_ids(c, 'property'));
  delete from public.vendor where contact_id = any(public.import_ids(c, 'vendor_contact'));
  delete from public.contact where id = any(public.import_ids(sets, 'contact'));
  delete from public.entity where id = any(public.import_ids(c, 'entity'));
  update public.import_batch set undone_at = now(), undone_by = auth.uid() where id = b.id;
end $$;
