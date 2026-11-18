alter table public.turnos
  add column if not exists oculto_cliente boolean not null default false;

create or replace function public.limpiar_mis_turnos_entregados()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cantidad integer;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión para limpiar el historial.';
  end if;

  update public.turnos
  set oculto_cliente = true
  where usuario_id = (select auth.uid())
    and estado = 'entregado'
    and oculto_cliente = false;

  get diagnostics cantidad = row_count;
  return cantidad;
end;
$$;

revoke all on function public.limpiar_mis_turnos_entregados() from public;
grant execute on function public.limpiar_mis_turnos_entregados() to authenticated;
