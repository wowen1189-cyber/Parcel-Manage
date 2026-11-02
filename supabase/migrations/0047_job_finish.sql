-- Finishing a job from a phone: before and after photos, what was done (optionally written up by the
-- company's AI from the tech's notes and photos), parts used, time on site, and two flags for the office:
-- a follow-up visit is needed, or the damage may be tenant-caused. Flags only create to-dos; any charge
-- to a tenant is the office's decision (CLAUDE.md rule 4). What the AI suggested is kept with its reasons.

alter table public.work_order
  add column parts_used text,
  add column hours_on_site numeric(5,2) check (hours_on_site >= 0 and hours_on_site <= 99),
  add column follow_up_needed boolean not null default false,
  add column follow_up_note text,
  add column tenant_damage_suspected boolean not null default false,
  add column tenant_damage_note text,
  add column completion_ai jsonb;

-- Which point in the job a photo shows: the tenant's report ("problem"), before work, or after.
alter table public.document add column photo_stage text check (photo_stage in ('problem', 'before', 'after'));
