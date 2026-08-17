-- Bloquear implica 'dislike': si no, el perfil reaparece en el feed.
create or replace function public.bloquear_usuario(p_otro_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_yo uuid := (select auth.uid());
begin
  if v_yo is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  if v_yo = p_otro_id then
    raise exception 'no puedes bloquearte a ti mismo' using errcode = '22023'; end if;
  if not exists (select 1 from public.perfiles where id = p_otro_id) then
    raise exception 'ese usuario no existe' using errcode = '22023'; end if;

  insert into public.bloqueos (bloqueador_id, bloqueado_id) values (v_yo, p_otro_id)
  on conflict (bloqueador_id, bloqueado_id) do nothing;

  insert into public.swipes (usuario_origen_id, usuario_destino_id, accion)
  values (v_yo, p_otro_id, 'dislike')
  on conflict (usuario_origen_id, usuario_destino_id) do update set accion = 'dislike';
end; $$;

create or replace function public.desbloquear_usuario(p_otro_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_yo uuid := (select auth.uid());
begin
  if v_yo is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  delete from public.bloqueos where bloqueador_id = v_yo and bloqueado_id = p_otro_id;
  -- El 'dislike' se mantiene: desbloquear no es volver a interesarse.
end; $$;

create or replace function public.listar_bloqueados()
returns table (id uuid, nombre text, creado_en timestamptz)
language sql stable security definer
set search_path = public, pg_temp as $$
  select p.id, p.nombre, b.creado_en
  from public.bloqueos b
  join public.perfiles p on p.id = b.bloqueado_id
  where b.bloqueador_id = (select auth.uid())
  order by b.creado_en desc;
$$;

-- Reportar bloquea por defecto: nadie denuncia a alguien con quien quiere seguir hablando.
create or replace function public.reportar_usuario(
  p_otro_id uuid,
  p_motivo public.motivo_reporte,
  p_detalle text default null,
  p_bloquear boolean default true
)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_yo uuid := (select auth.uid());
  v_nombre text;
  v_reporte_id uuid;
  v_recientes int;
begin
  if v_yo is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  if v_yo = p_otro_id then
    raise exception 'no puedes reportarte a ti mismo' using errcode = '22023'; end if;

  select nombre into v_nombre from public.perfiles where id = p_otro_id;
  if v_nombre is null then
    raise exception 'ese usuario no existe' using errcode = '22023'; end if;

  -- La denuncia masiva es en si misma una forma de acoso.
  select count(*) into v_recientes from public.reportes
  where reportante_id = v_yo and creado_en > now() - interval '1 hour';
  if v_recientes >= 10 then
    raise exception 'demasiados reportes en poco tiempo, prueba mas tarde'
      using errcode = '54000'; end if;

  insert into public.reportes
    (reportante_id, reportado_id, reportado_nombre, motivo, detalle)
  values (v_yo, p_otro_id, v_nombre, p_motivo, nullif(btrim(coalesce(p_detalle,'')), ''))
  returning id into v_reporte_id;

  if p_bloquear then perform public.bloquear_usuario(p_otro_id); end if;
  return v_reporte_id;
end; $$;

revoke execute on function public.bloquear_usuario(uuid) from public, anon;
revoke execute on function public.desbloquear_usuario(uuid) from public, anon;
revoke execute on function public.listar_bloqueados() from public, anon;
revoke execute on function public.reportar_usuario(uuid, public.motivo_reporte, text, boolean) from public, anon;
grant execute on function public.bloquear_usuario(uuid) to authenticated;
grant execute on function public.desbloquear_usuario(uuid) to authenticated;
grant execute on function public.listar_bloqueados() to authenticated;
grant execute on function public.reportar_usuario(uuid, public.motivo_reporte, text, boolean) to authenticated;
