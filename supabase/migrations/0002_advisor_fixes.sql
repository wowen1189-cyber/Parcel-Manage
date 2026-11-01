-- Fixes from Supabase's security and performance advisors after 0001_core.

-- Pin search_path on the remaining functions so a caller can't swap in look-alike objects.
alter function public.set_updated_at() set search_path = public;
alter function public.journal_entry_guard() set search_path = public;
alter function public.journal_line_guard() set search_path = public;

-- Trigger functions run only as triggers; nobody should call them through the API.
revoke execute on function public.audit_row() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.work_order_number() from public, anon, authenticated;

-- RLS helpers: signed-in users need them (policies call them); signed-out visitors don't.
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.member_role[]) from public, anon;
revoke execute on function public.shares_company(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.member_role[]) to authenticated;
grant execute on function public.shares_company(uuid) to authenticated;

-- Evaluate auth.uid() once per query instead of once per row.
alter policy profile_self on public.profile
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
