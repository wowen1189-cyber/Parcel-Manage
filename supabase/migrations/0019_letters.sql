-- Letters and notices: what was sent, how it was delivered (legal notices record the method: posted,
-- hand-delivered, mailed, certified mail, or e-mail under the 83.505 addendum), and the filed copy.
alter table public.message
  add column subject text,
  add column template_id text,
  add column delivery text check (delivery in ('email', 'portal', 'posted', 'hand_delivered', 'mail', 'certified_mail', 'print')),
  add column legal boolean not null default false,
  add column document_id uuid references public.document(id) on delete set null;
create index on public.message (company_id, created_at desc);
