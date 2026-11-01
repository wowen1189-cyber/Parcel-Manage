-- Move-out and the security deposit (Fla. Stat. 83.49(3)): after the tenancy ends, return the deposit
-- within 15 days, or send a notice of claim by certified mail (or e-mail under 83.505) within 30 days;
-- the tenant has 15 days after receiving it to object; the balance is due within 30 days of the notice.
create table public.move_out (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  lease_id uuid not null unique references public.lease(id) on delete cascade,
  vacated_on date not null,
  forwarding_address text,
  deductions jsonb not null default '[]',       -- [{description, amount_cents}]
  inspection_notes text,
  decision text check (decision in ('return_full', 'claim')),
  claim_notice_message_id uuid references public.message(id) on delete set null,
  claim_notice_sent_on date,
  claim_notice_method text check (claim_notice_method in ('certified_mail', 'email_addendum')),
  objection_received_on date,
  refund_cents int,
  refund_paid_on date,
  refund_reference text,
  closed_at timestamptz,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.move_out enable row level security;
create policy move_out_member_all on public.move_out for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create trigger move_out_updated_at before update on public.move_out for each row execute function public.set_updated_at();
create trigger move_out_audit after insert or update or delete on public.move_out for each row execute function public.audit_row();

-- Settle the deposit: apply part of it to what the tenant owes (trust cash moves to operating; the liability
-- clears the receivable) and refund the rest from trust. Both post balanced entries to the owner's books.
create or replace function public.settle_deposit(p_lease uuid, p_apply int, p_refund int, p_date date, p_reference text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v record;
begin
  if p_apply < 0 or p_refund < 0 or (p_apply = 0 and p_refund = 0) then raise exception 'Nothing to settle.'; end if;
  select l.company_id, l.unit_id, u.property_id, p.entity_id into v
  from public.lease l join public.unit u on u.id = l.unit_id join public.property p on p.id = u.property_id where l.id = p_lease;
  if v.company_id is null then raise exception 'Lease not found'; end if;
  if p_apply > 0 then
    perform public.post_journal_entry(v.company_id, v.entity_id, p_date, 'Security deposit applied to balance owed', 'deposit', jsonb_build_array(
      jsonb_build_object('account', '2100', 'debit', p_apply, 'property_id', v.property_id, 'unit_id', v.unit_id),
      jsonb_build_object('account', '1100', 'credit', p_apply, 'property_id', v.property_id, 'unit_id', v.unit_id),
      jsonb_build_object('account', '1000', 'debit', p_apply, 'property_id', v.property_id, 'unit_id', v.unit_id, 'memo', 'Moved from trust to operating'),
      jsonb_build_object('account', '1010', 'credit', p_apply, 'property_id', v.property_id, 'unit_id', v.unit_id)
    ));
    insert into public.payment (company_id, lease_id, method, amount_cents, received_on, status, purpose, reference, memo, created_by)
    values (v.company_id, p_lease, 'other', p_apply, p_date, 'succeeded', 'rent', 'Security deposit applied', 'Applied from the deposit at move-out', auth.uid());
  end if;
  if p_refund > 0 then
    perform public.post_journal_entry(v.company_id, v.entity_id, p_date, 'Security deposit refunded' || coalesce(' (' || p_reference || ')', ''), 'deposit', jsonb_build_array(
      jsonb_build_object('account', '2100', 'debit', p_refund, 'property_id', v.property_id, 'unit_id', v.unit_id),
      jsonb_build_object('account', '1010', 'credit', p_refund, 'property_id', v.property_id, 'unit_id', v.unit_id)
    ));
  end if;
end $$;
grant execute on function public.settle_deposit(uuid, int, int, date, text) to authenticated, service_role;
