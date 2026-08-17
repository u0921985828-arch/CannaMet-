-- CAMBIO DE PRODUCTO: el perfil deja de declarar consumo y pasa a declarar
-- contexto. Dos motivos:
--   1. La guideline 1.4.3 de Apple prohibe apps que "fomenten el consumo de
--      drogas ilegales". Un campo que declara metodo de consumo es exposicion
--      directa; el ambiente preferido no.
--   2. La preferencia de consumo podia ser dato de salud (art. 9 RGPD) y
--      obligaba a consentimiento explicito separado. El ambiente no lo es.
create type public.ambiente_preferido as enum (
  'casa','monte','musica','quedadas','crear','prefiero_no_decir'
);

alter table public.perfiles
  add column ambiente public.ambiente_preferido not null default 'prefiero_no_decir';

comment on column public.perfiles.ambiente is
  'Contexto preferido para quedar. No es dato de salud y no declara consumo.';

-- Las tres RPC cambian tipo de retorno: hay que dropear antes de recrear.
drop function if exists public.descubrir_perfiles(int, int);
drop function if exists public.listar_matches();
drop function if exists public.guardar_perfil(
  text, date, text, public.preferencia_consumo, double precision, double precision);

create or replace function public.descubrir_perfiles(
  p_radio_km int default 50, p_limite int default 20
)
returns table (
  id uuid, nombre text, edad int, bio text,
  ambiente public.ambiente_preferido, distancia_km numeric
)
language sql stable security definer
set search_path = public, extensions, pg_temp as $$
  select p.id, p.nombre, p.edad, p.bio, p.ambiente,
         round((extensions.st_distance(p.coordenadas, yo.coordenadas) / 1000)::numeric, 1)
  from public.perfiles p
  cross join lateral (
    select coordenadas from public.perfiles
    where id = (select auth.uid()) and coordenadas is not null
      and (suspendido_hasta is null or suspendido_hasta <= now())
  ) yo
  where p.id <> (select auth.uid())
    and p.coordenadas is not null
    and (p.suspendido_hasta is null or p.suspendido_hasta <= now())
    and extensions.st_dwithin(p.coordenadas, yo.coordenadas, greatest(p_radio_km, 1) * 1000)
    and not exists (select 1 from public.swipes s
      where s.usuario_origen_id = (select auth.uid()) and s.usuario_destino_id = p.id)
    and not exists (select 1 from public.bloqueos b
      where (b.bloqueador_id = (select auth.uid()) and b.bloqueado_id = p.id)
         or (b.bloqueador_id = p.id and b.bloqueado_id = (select auth.uid())))
  order by p.coordenadas <-> yo.coordenadas
  limit least(greatest(p_limite, 1), 50);
$$;

create or replace function public.listar_matches()
returns table (
  match_id uuid, otro_id uuid, otro_nombre text, otro_edad int,
  otro_ambiente public.ambiente_preferido,
  ultimo_mensaje text, ultimo_mensaje_en timestamptz,
  no_leidos bigint, creado_en timestamptz
)
language sql stable security definer
set search_path = public, pg_temp as $$
  select m.id, o.id, o.nombre, o.edad, o.ambiente,
         um.contenido, um.creado_en, coalesce(nl.total, 0), m.creado_en
  from public.matches m
  join public.perfiles o
    on o.id = case when m.usuario_1_id = (select auth.uid())
                   then m.usuario_2_id else m.usuario_1_id end
  left join lateral (
    select contenido, creado_en from public.mensajes
    where match_id = m.id order by creado_en desc, id desc limit 1
  ) um on true
  left join lateral (
    select count(*) as total from public.mensajes
    where match_id = m.id and remitente_id <> (select auth.uid()) and leido = false
  ) nl on true
  where (select auth.uid()) in (m.usuario_1_id, m.usuario_2_id)
    and not exists (select 1 from public.bloqueos b
      where (b.bloqueador_id = m.usuario_1_id and b.bloqueado_id = m.usuario_2_id)
         or (b.bloqueador_id = m.usuario_2_id and b.bloqueado_id = m.usuario_1_id))
  order by coalesce(um.creado_en, m.creado_en) desc;
$$;

create or replace function public.guardar_perfil(
  p_nombre text,
  p_fecha_nacimiento date,
  p_bio text default null,
  p_ambiente public.ambiente_preferido default 'prefiero_no_decir',
  p_lat double precision default null,
  p_lng double precision default null
)
returns table (
  id uuid, nombre text, edad int, bio text,
  ambiente public.ambiente_preferido,
  tiene_ubicacion boolean, actualizado_en timestamptz
)
language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_yo uuid := (select auth.uid());
  v_punto extensions.geography;
  v_edad int;
begin
  if v_yo is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  if p_fecha_nacimiento is null then
    raise exception 'falta la fecha de nacimiento' using errcode = '22023'; end if;

  v_edad := public.edad_de(p_fecha_nacimiento);
  if v_edad < 18 then
    raise exception 'MATCH es solo para mayores de 18 anos' using errcode = '22023'; end if;
  if v_edad > 120 then
    raise exception 'revisa la fecha de nacimiento' using errcode = '22023'; end if;

  if not public.consentimiento_al_dia() then
    raise exception 'tienes que aceptar los terminos y la politica de privacidad'
      using errcode = '22023'; end if;

  if p_lat is not null and p_lng is not null then
    if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
      raise exception 'coordenadas fuera de rango' using errcode = '22023'; end if;
    v_punto := extensions.st_setsrid(
      extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  return query
  insert into public.perfiles as p
    (id, nombre, edad, fecha_nacimiento, bio, ambiente, coordenadas)
  values (v_yo, btrim(p_nombre), v_edad, p_fecha_nacimiento,
          nullif(btrim(coalesce(p_bio,'')), ''), p_ambiente, v_punto)
  on conflict (id) do update set
    nombre = excluded.nombre, edad = excluded.edad,
    fecha_nacimiento = excluded.fecha_nacimiento, bio = excluded.bio,
    ambiente = excluded.ambiente,
    coordenadas = coalesce(excluded.coordenadas, p.coordenadas)
  returning p.id, p.nombre, p.edad, p.bio, p.ambiente,
            (p.coordenadas is not null), p.actualizado_en;
end; $$;

revoke execute on function public.descubrir_perfiles(int, int) from public, anon;
revoke execute on function public.listar_matches() from public, anon;
revoke execute on function public.guardar_perfil(
  text, date, text, public.ambiente_preferido, double precision, double precision)
  from public, anon;
grant execute on function public.descubrir_perfiles(int, int) to authenticated;
grant execute on function public.listar_matches() to authenticated;
grant execute on function public.guardar_perfil(
  text, date, text, public.ambiente_preferido, double precision, double precision)
  to authenticated;
