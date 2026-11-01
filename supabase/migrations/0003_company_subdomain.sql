-- Each company gets its own web address: <subdomain>.<root domain> (SIM REI: simreipm.parcelmanage.com).

alter table public.company
  add column subdomain text unique
    check (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$');

-- Names the app itself uses, so no company can take them.
create table public.reserved_subdomain (name text primary key);
insert into public.reserved_subdomain (name) values
  ('www'), ('app'), ('api'), ('admin'), ('mail'), ('email'), ('help'), ('support'),
  ('status'), ('docs'), ('blog'), ('auth'), ('login'), ('signup'), ('static'), ('assets'), ('mcp');
alter table public.reserved_subdomain enable row level security;

create or replace function public.subdomain_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.subdomain is not null and exists (select 1 from public.reserved_subdomain where name = new.subdomain) then
    raise exception 'That web address is reserved. Pick another.';
  end if;
  return new;
end $$;
create trigger company_subdomain_guard before insert or update of subdomain on public.company
  for each row execute function public.subdomain_guard();
revoke execute on function public.subdomain_guard() from public, anon, authenticated;

-- Before sign-in, a visitor on <subdomain>.<root> only learns the company's id and public name.
create or replace function public.company_by_subdomain(p_subdomain text)
returns table (id uuid, name text, office_phone text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.office_phone from public.company c where c.subdomain = lower(p_subdomain);
$$;
revoke execute on function public.company_by_subdomain(text) from public;
grant execute on function public.company_by_subdomain(text) to anon, authenticated;

-- Is this web address free? (Signup form check.)
create or replace function public.subdomain_available(p_subdomain text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(p_subdomain) ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'
     and not exists (select 1 from public.company where subdomain = lower(p_subdomain))
     and not exists (select 1 from public.reserved_subdomain where name = lower(p_subdomain));
$$;
revoke execute on function public.subdomain_available(text) from public, anon;
grant execute on function public.subdomain_available(text) to authenticated;

-- Company creation now takes the web address too.
drop function public.create_company(text, text);
create or replace function public.create_company(p_name text, p_subdomain text, p_time_zone text default 'America/New_York')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  insert into public.company (name, subdomain, time_zone)
  values (p_name, lower(p_subdomain), p_time_zone) returning id into cid;
  insert into public.membership (company_id, profile_id, role) values (cid, auth.uid(), 'admin');
  return cid;
end $$;
revoke execute on function public.create_company(text, text, text) from public, anon;
grant execute on function public.create_company(text, text, text) to authenticated;
