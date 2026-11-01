-- Vendor job links and bills.
-- When a work order is assigned, the vendor gets a private link (only a hash is stored) to accept or
-- decline, schedule the visit (83.53(2) notice is checked and the tenant notified), mark it done with
-- photos, and upload the invoice. Invoices become bills that need approval before payment (CLAUDE.md rule 4).

alter table public.work_order
  add column vendor_token_hash text unique,
  add column vendor_accepted_at timestamptz,
  add column vendor_declined_at timestamptz,
  add column vendor_decline_reason text,
  add column vendor_completed_at timestamptz;

create table public.bill (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  entity_id uuid references public.entity(id),          -- whose books (the property's owner)
  vendor_id uuid references public.vendor(id),
  property_id uuid references public.property(id),
  unit_id uuid references public.unit(id),
  work_order_id uuid references public.work_order(id) on delete set null,
  invoice_number text,
  invoice_date date,
  due_date date,
  amount_cents int not null check (amount_cents > 0),
  expense_account text not null default '5000',        -- gl_account number to charge
  memo text,
  status text not null default 'received' check (status in ('received', 'approved', 'scheduled', 'paid', 'void')),
  source text not null default 'manual',                -- manual, vendor portal, email, recurring
  document_id uuid references public.document(id),
  approved_by uuid references public.profile(id),
  approved_at timestamptz,
  journal_entry_id uuid references public.journal_entry(id),   -- expense and payable, posted on approval
  paid_on date,
  payment_method text,
  payment_reference text,
  paid_entry_id uuid references public.journal_entry(id),      -- payable paid from cash
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.bill (company_id, status, due_date);
create index on public.bill (company_id, vendor_id);
alter table public.bill enable row level security;
create policy bill_member_all on public.bill for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger bill_updated_at before update on public.bill for each row execute function public.set_updated_at();
create trigger bill_audit after insert or update or delete on public.bill for each row execute function public.audit_row();

alter table public.document add column bill_id uuid references public.bill(id) on delete set null;
