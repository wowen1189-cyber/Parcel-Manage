-- Move-in and move-out inspections: room by room condition, notes and photos (lib/inspections.ts). The
-- move-out page compares them and suggests deposit deductions for damage beyond normal wear and tear
-- (Fla. Stat. 83.49(3), 83.491); a person decides every deduction.
create table public.inspection (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  lease_id uuid not null references public.lease(id) on delete cascade,
  kind text not null check (kind in ('move_in', 'move_out')),
  inspected_on date not null,
  rooms jsonb not null default '[]',   -- [{id, room, condition: good|fair|damaged|missing, notes, photos: [storage paths]}]
  notes text,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, kind)
);
alter table public.inspection enable row level security;
create policy inspection_member_all on public.inspection for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger inspection_updated_at before update on public.inspection for each row execute function public.set_updated_at();
create trigger inspection_audit after insert or update or delete on public.inspection for each row execute function public.audit_row();

-- Suggested deductions (from AI, or the rooms that got worse when AI isn't connected), kept until a person
-- adds or dismisses them.
alter table public.move_out add column suggested_deductions jsonb not null default '[]';
