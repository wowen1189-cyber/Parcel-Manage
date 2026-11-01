-- Phase 1 maintenance: entry rules, vendor notification and completion details on work orders.

-- Why the vendor may enter (Fla. Stat. 83.53(2)): 24 hours' notice for repairs, entry between 7:30 a.m. and
-- 8:00 p.m.; or the tenant consented; or an emergency; or the unit is vacant.
alter table public.work_order
  add column entry_basis text check (entry_basis in ('notice', 'tenant_agreed', 'emergency', 'vacant')),
  add column entry_notice_method text check (entry_notice_method in ('posted', 'hand_delivered', 'email_addendum', 'mail')),
  add column entry_notice_at timestamptz,          -- when notice was given (must be 24h+ before entry)
  add column vendor_notified_at timestamptz,
  add column cost_cents int check (cost_cents >= 0),
  add column resolution text,
  add column priority_reason text;                 -- why staff changed the triage priority, if they did

-- Leases record whether the tenant signed the 83.505 e-mail notice addendum (e-mail is then legal notice).
alter table public.lease add column email_notices_agreed boolean not null default false;

create index on public.work_order (company_id, status, priority);
create index on public.work_order_event (work_order_id, created_at);
