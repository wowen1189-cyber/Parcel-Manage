-- E-mailed vendor invoices (lib/invoice-intake.ts). Each company has its own address; an invoice that arrives
-- becomes a bill waiting for approval. Its total may be unknown until a person enters it, so a bill that is
-- still waiting (or voided) may have no amount yet; approving still requires one (app/(manager)/bills/actions.ts).

alter table public.bill drop constraint bill_amount_cents_check;
alter table public.bill add constraint bill_amount_cents_check check (amount_cents > 0 or (amount_cents = 0 and status in ('received', 'void')));
alter table public.bill
  add column from_email text,          -- who e-mailed it in
  add column review_notes text[] not null default '{}';   -- what the approver should double-check

-- Every e-mail received, including ones that didn't become a bill, so nothing disappears silently.
create table public.inbound_email (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  provider_id text not null unique,     -- Resend's id (each e-mail is handled once)
  from_address text not null,
  subject text,
  status text not null check (status in ('bill', 'skipped', 'failed')),
  note text,
  bill_id uuid references public.bill(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.inbound_email (company_id, created_at desc);
alter table public.inbound_email enable row level security;
create policy inbound_email_member_read on public.inbound_email for select using (public.is_member(company_id));
