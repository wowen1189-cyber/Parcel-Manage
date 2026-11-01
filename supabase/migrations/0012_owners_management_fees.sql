-- Owners: the entity (LLC or person) that owns one or more properties gets contact details and a
-- management agreement. Every property points at its owner (property.entity_id), so an owner's
-- properties are always grouped under it.
alter table public.entity
  add column email text,
  add column phone text,
  add column mailing_address text,
  add column notes text,
  add column management_fee jsonb not null default '{}'::jsonb,   -- lib/management-fees.ts; {} = company default
  add column updated_at timestamptz not null default now();

create trigger entity_updated_at before update on public.entity for each row execute function public.set_updated_at();

-- A property can carry its own fee instead of its owner's (null = use the owner's).
alter table public.property add column management_fee jsonb;
