create schema private;

revoke all on schema private from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('customer', 'admin', 'super_admin')),
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter function private.set_updated_at() owner to postgres;
revoke all on function private.set_updated_at() from public;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- SECURITY DEFINER is required so signup can write outside the Auth schema.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'phone'), '')
  );

  insert into private.user_roles (user_id, role)
  values (new.id, 'customer');

  return new;
end;
$$;

alter function private.handle_new_user() owner to postgres;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- A non-login owner gives the role predicate only the access it needs.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'app_rls_role_reader'
  ) then
    create role app_rls_role_reader nologin noinherit;
  end if;
end
$$;
grant usage on schema private to app_rls_role_reader;
grant select on private.user_roles to app_rls_role_reader;
grant create on schema private to app_rls_role_reader;

-- Supabase owns the auth schema ACL, so bridge auth.uid() without broadening it.
create function private.current_auth_uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select auth.uid() $$;

revoke all on function private.current_auth_uid() from public, anon, authenticated;
grant execute on function private.current_auth_uid() to app_rls_role_reader;

-- SECURITY DEFINER avoids recursive role-table authorization checks.
create function private.has_role(required_role text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  subject_id uuid := private.current_auth_uid();
begin
  if required_role is null
     or required_role not in ('customer', 'admin', 'super_admin') then
    raise exception 'unsupported role: %', required_role
      using errcode = '22023';
  end if;

  if subject_id is null then
    return false;
  end if;

  return exists (
    select 1
    from private.user_roles as ur
    where ur.user_id = subject_id
      and ur.role = required_role
  );
end;
$$;

grant app_rls_role_reader to postgres;
alter function private.has_role(text) owner to app_rls_role_reader;
revoke all on function private.has_role(text) from public, anon, authenticated, service_role;
grant execute on function private.has_role(text) to authenticated;
revoke app_rls_role_reader from postgres;
revoke create on schema private from app_rls_role_reader;
