-- FALLO CORREGIDO: reportante_id tenia ON DELETE CASCADE. Si la persona acosada
-- borraba su cuenta, sus denuncias desaparecian y el acosador quedaba limpio.
alter table public.reportes drop constraint reportes_reportante_id_fkey;
alter table public.reportes
  add constraint reportes_reportante_id_fkey
  foreign key (reportante_id) references public.perfiles(id) on delete set null;

comment on column public.reportes.reportante_id is
  'NULL si el denunciante borro su cuenta o si origen = automatico. '
  'La denuncia permanece: borrarse no debe limpiar el expediente de nadie.';

-- ── Art. 17 RGPD: supresion ──
-- Cascadea perfil, swipes, matches, mensajes, bloqueos y apelaciones.
-- Los reportes SOBRE esta persona permanecen anonimizados: borrarse no puede
-- ser una via de escape de la moderacion.
create or replace function public.borrar_mi_cuenta()
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_yo uuid := (select auth.uid());
begin
  if v_yo is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  delete from auth.users where id = v_yo;
end; $$;

-- ── Art. 15 RGPD: acceso ──
-- Devuelve si hay ubicacion, nunca el punto: no materializamos coordenadas en
-- un fichero que el usuario acabara compartiendo o subiendo a la nube.
create or replace function public.exportar_mis_datos()
returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'generado_en', now(),
    'perfil', (select to_jsonb(x) from (
      select p.id, p.nombre, p.edad, p.bio, p.preferencia_consumo,
             (p.coordenadas is not null) as tiene_ubicacion,
             p.creado_en, p.actualizado_en, p.suspendido_hasta, p.suspension_motivo
      from public.perfiles p where p.id = (select auth.uid())) x),
    'swipes_emitidos', (select coalesce(count(*),0) from public.swipes
      where usuario_origen_id = (select auth.uid())),
    'matches', (select coalesce(jsonb_agg(jsonb_build_object(
        'con', o.nombre, 'desde', m.creado_en)), '[]'::jsonb)
      from public.matches m join public.perfiles o on o.id = case
        when m.usuario_1_id = (select auth.uid()) then m.usuario_2_id else m.usuario_1_id end
      where (select auth.uid()) in (m.usuario_1_id, m.usuario_2_id)),
    'mensajes_enviados', (select coalesce(jsonb_agg(jsonb_build_object(
        'contenido', contenido, 'enviado_en', creado_en) order by creado_en), '[]'::jsonb)
      from public.mensajes where remitente_id = (select auth.uid())),
    'bloqueos_realizados', (select coalesce(jsonb_agg(jsonb_build_object(
        'nombre', p.nombre, 'fecha', b.creado_en)), '[]'::jsonb)
      from public.bloqueos b join public.perfiles p on p.id = b.bloqueado_id
      where b.bloqueador_id = (select auth.uid())),
    'reportes_emitidos', (select coalesce(jsonb_agg(jsonb_build_object(
        'sobre', reportado_nombre, 'motivo', motivo, 'detalle', detalle,
        'fecha', creado_en, 'estado', estado)), '[]'::jsonb)
      from public.reportes where reportante_id = (select auth.uid())),
    'apelaciones', (select coalesce(jsonb_agg(jsonb_build_object(
        'texto', texto, 'estado', estado, 'fecha', creado_en)), '[]'::jsonb)
      from public.apelaciones where usuario_id = (select auth.uid()))
  );
$$;

revoke execute on function public.borrar_mi_cuenta() from public, anon;
revoke execute on function public.exportar_mis_datos() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;
grant execute on function public.exportar_mis_datos() to authenticated;

-- ── Art. 5.1.e RGPD: limitacion del plazo de conservacion ──
create or replace function public.purgar_reportes_antiguos()
returns int language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_dias int := (public.cfg()).dias_retencion_reportes; v_borrados int;
begin
  with borrados as (
    delete from public.reportes
    where estado <> 'pendiente' and resuelto_en is not null
      and resuelto_en < now() - make_interval(days => v_dias)
    returning 1)
  select count(*)::int into v_borrados from borrados;

  delete from public.apelaciones
  where estado <> 'pendiente' and resuelta_en is not null
    and resuelta_en < now() - make_interval(days => v_dias);

  return v_borrados;
end; $$;

revoke execute on function public.purgar_reportes_antiguos() from public, anon, authenticated;

-- Programado a diario a las 04:00
create extension if not exists pg_cron;
select cron.schedule('purga-reportes-antiguos', '0 4 * * *',
  $CRON$select public.purgar_reportes_antiguos();$CRON$);

-- Postgres concede EXECUTE a PUBLIC por defecto. Una funcion de trigger
-- SECURITY DEFINER expuesta en /rest/v1/rpc/ seria invocable a mano por
-- cualquiera; el trigger la sigue ejecutando igual porque corre como su
-- propietario, no como el rol que dispara el INSERT.
revoke execute on function public.tg_senal_bloqueos_repetidos() from public, anon, authenticated;
revoke execute on function public.tg_set_actualizado_en() from public, anon, authenticated;
revoke all on public.moderadores from public;
revoke all on public.config_moderacion from public;
