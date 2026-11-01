-- Per-person screen preferences: menu order (sidebar groups and items) and dashboard tile layout.
-- Each person edits only their own row (profile_self policy already allows it).
alter table public.profile add column preferences jsonb not null default '{}'::jsonb;
