-- Renewal offers (lib/renewal-offers.ts): the office sends a tenant up to three options (one may be
-- month-to-month); the tenant picks one in their portal; a person then applies it to the lease.
create table public.renewal_offer (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  lease_id uuid not null references public.lease(id) on delete cascade,
  increase_percent numeric(5,2) not null,
  options jsonb not null,                -- RenewalChoice[] as offered (rent fixed at the time of the offer)
  message text,
  respond_by date not null,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn', 'applied')),
  sent_to text[] not null default '{}',
  sent_at timestamptz not null default now(),
  chosen_option int,                     -- index into options
  responded_at timestamptz,
  responded_by uuid references public.contact(id),
  applied_at timestamptz,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now()
);
create index renewal_offer_lease on public.renewal_offer (company_id, lease_id, created_at desc);
alter table public.renewal_offer enable row level security;
create policy renewal_offer_member_all on public.renewal_offer for all using (public.is_member(company_id)) with check (public.is_member(company_id));
-- Tenants see offers on their own lease (they answer through the portal's server action).
create policy renewal_offer_portal_read on public.renewal_offer for select using (lease_id in (select public.portal_lease_ids()));
create trigger renewal_offer_audit after insert or update or delete on public.renewal_offer for each row execute function public.audit_row();
