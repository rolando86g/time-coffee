create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

drop policy if exists "Cada usuario puede leer su perfil" on public.perfiles;
create policy "Cada usuario puede leer su perfil"
  on public.perfiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke all on function public.crear_perfil_usuario() from public;

drop trigger if exists al_crear_usuario_auth on auth.users;
create trigger al_crear_usuario_auth
  after insert on auth.users
  for each row execute procedure public.crear_perfil_usuario();

insert into public.perfiles (id, email)
select id, email
from auth.users
on conflict (id) do nothing;
