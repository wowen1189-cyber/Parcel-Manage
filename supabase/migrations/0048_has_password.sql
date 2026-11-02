-- Whether the signed-in person has set a password yet. People invited by e-mail (staff, tenants, owners)
-- first sign in with an e-mailed link, and are then asked to choose a password (app/(auth)/set-password).
create or replace function public.has_password() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select encrypted_password from auth.users where id = auth.uid()), '') <> '';
$$;
revoke execute on function public.has_password() from public, anon;
grant execute on function public.has_password() to authenticated;
