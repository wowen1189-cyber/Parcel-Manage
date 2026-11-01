-- Automations: the daily job either sends a routine message (rent reminder, insurance reminder, visit
-- reminder) or, for anything with legal weight, creates a task for a person (3-day notice, 83.575(2)
-- pre-notice, renewal decision, missing entry notice). Each automation runs once per thing per period
-- (unique key), and every routine send is recorded here too.
create table public.automation_task (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  key text not null,
  kind text not null,
  lease_id uuid references public.lease(id) on delete cascade,
  work_order_id uuid references public.work_order(id) on delete cascade,
  title text not null,
  detail text not null default '',
  letter_template text,
  due_on date,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed', 'sent')),
  done_at timestamptz,
  done_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  unique (company_id, key)
);
alter table public.automation_task enable row level security;
create policy automation_task_member_all on public.automation_task for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger automation_task_audit after insert or update or delete on public.automation_task for each row execute function public.audit_row();
create index automation_task_open on public.automation_task (company_id, status, due_on);
