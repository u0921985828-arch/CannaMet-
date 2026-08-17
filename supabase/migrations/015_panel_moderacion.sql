-- Tabla aparte, no un booleano en perfiles: el rol no debe viajar nunca
-- en la misma fila que se sirve a otros usuarios.
create table public.moderadores (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  nota text
);
alter table public.moderadores enable row level security;
revoke all on public.moderadores from anon, authenticated;

comment on table public.moderadores is
  'Alta solo con service_role desde el dashboard. Ningun cliente escribe aqui.';

create or replace function public.soy_moderador()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (select 1 from public.moderadores where usuario_id = (select auth.uid()));
$$;

create policy reportes_select_moderador on public.reportes
  for select to authenticated using (public.soy_moderador());

-- Rastro de quien resolvio que. Sin esto el panel no es auditable.
alter table public.reportes
  add column resuelto_por uuid references auth.users(id) on delete set null,
  add column resuelto_en timestamptz,
  add column nota_moderacion text;

create or replace function public.moderacion_cola(p_limite int default 50)
returns table (
  id uuid, motivo public.motivo_reporte, origen public.origen_reporte,
  detalle text, creado_en timestamptz,
  reportado_id uuid, reportado_nombre text, reportado_existe boolean,
  reportado_suspendido_hasta timestamptz,
  veces_reportado bigint, veces_bloqueado bigint
)
language sql stable security definer
set search_path = public, pg_temp as $$
  select r.id, r.motivo, r.origen, r.detalle, r.creado_en,
         r.reportado_id, r.reportado_nombre, (p.id is not null), p.suspendido_hasta,
         -- Contexto: un reporte suelto y el decimo no son el mismo caso.
         (select count(*) from public.reportes r2 where r2.reportado_id = r.reportado_id),
         (select count(*) from public.bloqueos b where b.bloqueado_id = r.reportado_id)
  from public.reportes r
  left join public.perfiles p on p.id = r.reportado_id
  where public.soy_moderador() and r.estado = 'pendiente'
  order by
    -- Lo que exige actuacion inmediata, primero.
    (r.motivo = 'menor_de_edad') desc,
    (r.motivo = 'acoso_o_amenazas') desc,
    r.creado_en asc
  limit least(greatest(p_limite, 1), 200);
$$;

create or replace function public.moderacion_resolver(
  p_reporte_id uuid,
  p_estado public.estado_reporte,
  p_suspender_dias int default null,
  p_nota text default null
)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_yo uuid := (select auth.uid()); v_reportado uuid;
begin
  if not public.soy_moderador() then
    raise exception 'no autorizado' using errcode = '42501'; end if;
  if p_estado = 'pendiente' then
    raise exception 'resolver exige un estado final' using errcode = '22023'; end if;

  select reportado_id into v_reportado from public.reportes where id = p_reporte_id;

  update public.reportes
  set estado = p_estado, resuelto_por = v_yo, resuelto_en = now(),
      nota_moderacion = nullif(btrim(coalesce(p_nota,'')), '')
  where id = p_reporte_id;

  if p_suspender_dias is not null and v_reportado is not null then
    if p_suspender_dias < 1 or p_suspender_dias > 3650 then
      raise exception 'duracion de suspension fuera de rango' using errcode = '22023'; end if;
    update public.perfiles
    set suspendido_hasta = now() + make_interval(days => p_suspender_dias),
        suspension_motivo = nullif(btrim(coalesce(p_nota,'')), '')
    where id = v_reportado;
  end if;
end; $$;

create or replace function public.moderacion_levantar_suspension(p_usuario_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.soy_moderador() then
    raise exception 'no autorizado' using errcode = '42501'; end if;
  update public.perfiles set suspendido_hasta = null, suspension_motivo = null
  where id = p_usuario_id;
end; $$;

revoke execute on function public.soy_moderador() from public, anon;
revoke execute on function public.moderacion_cola(int) from public, anon;
revoke execute on function public.moderacion_resolver(uuid, public.estado_reporte, int, text) from public, anon;
revoke execute on function public.moderacion_levantar_suspension(uuid) from public, anon;
grant execute on function public.soy_moderador() to authenticated;
grant execute on function public.moderacion_cola(int) to authenticated;
grant execute on function public.moderacion_resolver(uuid, public.estado_reporte, int, text) to authenticated;
grant execute on function public.moderacion_levantar_suspension(uuid) to authenticated;
