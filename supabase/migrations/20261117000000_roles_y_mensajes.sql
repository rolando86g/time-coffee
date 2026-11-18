create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user'
);

alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin'));
  end if;
end;
$$;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into public.profiles (id, role)
select id, 'user'
from auth.users
on conflict (id) do nothing;

alter table public.mensajes enable row level security;

revoke all on table public.mensajes from anon, authenticated;
grant select on table public.mensajes to anon, authenticated;
grant insert, update, delete on table public.mensajes to authenticated;

revoke all on sequence public.mensajes_id_seq from anon, authenticated;
grant usage, select on sequence public.mensajes_id_seq to authenticated;

drop policy if exists "Anyone can read mensajes" on public.mensajes;
create policy "Anyone can read mensajes"
  on public.mensajes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can add mensajes" on public.mensajes;
create policy "Authenticated users can add mensajes"
  on public.mensajes
  for insert
  to authenticated
  with check (true);

drop policy if exists "Admins can update mensajes" on public.mensajes;
create policy "Admins can update mensajes"
  on public.mensajes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can delete mensajes" on public.mensajes;
create policy "Admins can delete mensajes"
  on public.mensajes
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception 'No existe la publicación supabase_realtime.';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'mensajes'
  ) then
    execute 'alter publication supabase_realtime add table public.mensajes';
  end if;
end;
$$;
