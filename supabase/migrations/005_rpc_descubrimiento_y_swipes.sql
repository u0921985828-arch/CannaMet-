create or replace function public.descubrir_perfiles(
  p_radio_km int default 50,
  p_limite int default 20
)
returns table (
  id uuid, nombre text, edad int, bio text,
  preferencia_consumo public.preferencia_consumo, distancia_km numeric
)
language sql stable security definer
set search_path = public, extensions, pg_temp as $$
  select p.id, p.nombre, p.edad, p.bio, p.preferencia_consumo,
         round((extensions.st_distance(p.coordenadas, yo.coordenadas) / 1000)::numeric, 1)
  from public.perfiles p
  cross join lateral (
    select coordenadas from public.perfiles
    where id = (select auth.uid()) and coordenadas is not null
  ) yo
  where p.id <> (select auth.uid())
    and p.coordenadas is not null
    and extensions.st_dwithin(p.coordenadas, yo.coordenadas, greatest(p_radio_km, 1) * 1000)
    and not exists (
      select 1 from public.swipes s
      where s.usuario_origen_id = (select auth.uid()) and s.usuario_destino_id = p.id
    )
  order by p.coordenadas <-> yo.coordenadas
  limit least(greatest(p_limite, 1), 50);
$$;
revoke execute on function public.descubrir_perfiles(int, int) from public, anon;
grant execute on function public.descubrir_perfiles(int, int) to authenticated;

create or replace function public.registrar_swipe(
  p_destino_id uuid,
  p_accion public.accion_swipe
)
returns table (hay_match boolean, match_id uuid)
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_yo uuid := (select auth.uid());
  v_reciproco boolean := false;
  v_match_id uuid;
begin
  if v_yo is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  if v_yo = p_destino_id then
    raise exception 'no puedes hacer swipe sobre ti mismo' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfiles where id = v_yo) then
    raise exception 'perfil no creado: completa el onboarding' using errcode = '22023';
  end if;

  insert into public.swipes (usuario_origen_id, usuario_destino_id, accion)
  values (v_yo, p_destino_id, p_accion)
  on conflict (usuario_origen_id, usuario_destino_id)
  do update set accion = excluded.accion, creado_en = now();

  if p_accion <> 'like' then
    return query select false, null::uuid; return;
  end if;

  select true into v_reciproco from public.swipes s
  where s.usuario_origen_id = p_destino_id
    and s.usuario_destino_id = v_yo and s.accion = 'like';

  if not coalesce(v_reciproco, false) then
    return query select false, null::uuid; return;
  end if;

  insert into public.matches (usuario_1_id, usuario_2_id)
  values (least(v_yo, p_destino_id), greatest(v_yo, p_destino_id))
  on conflict (usuario_1_id, usuario_2_id)
  do update set creado_en = public.matches.creado_en
  returning id into v_match_id;

  return query select true, v_match_id;
end; $$;
revoke execute on function public.registrar_swipe(uuid, public.accion_swipe) from public, anon;
grant execute on function public.registrar_swipe(uuid, public.accion_swipe) to authenticated;
