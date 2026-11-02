-- Projects (renovations, unit turns) with a budget; purchase orders that commit spending with a vendor and
-- need a person's approval (CLAUDE.md rule 4); bills tied to a PO or project count as spent. Plus inventory
-- (supplies kept on hand, used on work orders) and keys (key sets per property or unit, checked out and back).
create table public.project (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  property_id uuid not null references public.property(id) on delete cascade,
  unit_id uuid references public.unit(id) on delete set null,
  name text not null check (length(name) between 2 and 150),
  budget_cents bigint not null default 0 check (budget_cents >= 0),
  status text not null default 'active' check (status in ('planning', 'active', 'done', 'canceled')),
  start_on date,
  target_on date,
  notes text,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.purchase_order (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  number int not null,
  vendor_id uuid not null references public.vendor(id),
  property_id uuid not null references public.property(id),
  project_id uuid references public.project(id) on delete set null,
  work_order_id uuid references public.work_order(id) on delete set null,
  description text not null check (length(description) between 2 and 500),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'draft' check (status in ('draft', 'approved', 'closed', 'void')),
  approved_by uuid references public.profile(id),
  approved_at timestamptz,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);
create or replace function public.purchase_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.number is null or new.number = 0 then
    perform pg_advisory_xact_lock(hashtext('purchase_order_number:' || new.company_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.purchase_order where company_id = new.company_id;
  end if;
  return new;
end $$;
create trigger purchase_order_number before insert on public.purchase_order for each row execute function public.purchase_order_number();
alter table public.bill add column project_id uuid references public.project(id) on delete set null;
alter table public.bill add column purchase_order_id uuid references public.purchase_order(id) on delete set null;

create table public.inventory_item (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  location text,
  quantity int not null default 0 check (quantity >= 0),
  reorder_at int not null default 0 check (reorder_at >= 0),
  unit_cost_cents int not null default 0 check (unit_cost_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.inventory_move (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  item_id uuid not null references public.inventory_item(id) on delete cascade,
  change int not null check (change <> 0),          -- + received, - used
  work_order_id uuid references public.work_order(id) on delete set null,
  note text,
  moved_by uuid references public.profile(id),
  created_at timestamptz not null default now()
);
create table public.key_set (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  property_id uuid not null references public.property(id) on delete cascade,
  unit_id uuid references public.unit(id) on delete cascade,
  label text not null check (length(label) between 1 and 120),
  tag text,                                         -- the number on the key tag (never the door code)
  copies int not null default 1 check (copies >= 0),
  location text,
  created_at timestamptz not null default now()
);
create table public.key_checkout (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  key_set_id uuid not null references public.key_set(id) on delete cascade,
  holder text not null check (length(holder) between 1 and 120),
  vendor_id uuid references public.vendor(id) on delete set null,
  work_order_id uuid references public.work_order(id) on delete set null,
  out_at timestamptz not null default now(),
  due_back_on date,
  returned_at timestamptz,
  checked_out_by uuid references public.profile(id)
);
create unique index key_checkout_one_open on public.key_checkout (key_set_id) where returned_at is null;

do $$
declare t text;
begin
  foreach t in array array['project', 'purchase_order', 'inventory_item', 'inventory_move', 'key_set', 'key_checkout'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all using (public.is_member(company_id)) with check (public.is_member(company_id))', t || '_member_all', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
  foreach t in array array['project', 'purchase_order', 'inventory_item'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;
