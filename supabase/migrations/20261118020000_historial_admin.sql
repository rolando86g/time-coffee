alter table public.turnos
  add column if not exists oculto_admin boolean not null default false;

create or replace function public.limpiar_turnos_entregados_admin()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cantidad integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  ) then
    raise exception 'Se requiere una cuenta administradora para limpiar el historial.';
  end if;

  update public.turnos
  set oculto_admin = true
  where estado = 'entregado'
    and oculto_admin = false;

  get diagnostics cantidad = row_count;
  return cantidad;
end;
$$;

revoke all on function public.limpiar_turnos_entregados_admin() from public;
grant execute on function public.limpiar_turnos_entregados_admin() to authenticated;
