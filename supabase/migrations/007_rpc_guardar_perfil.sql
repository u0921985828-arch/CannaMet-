create or replace function public.guardar_perfil(
  p_nombre text,
  p_edad int,
  p_bio text default null,
  p_preferencia public.preferencia_consumo default 'prefiero_no_decir',
  p_lat double precision default null,
  p_lng double precision default null
)
returns table (
  id uuid, nombre text, edad int, bio text,
  preferencia_consumo public.preferencia_consumo,
  tiene_ubicacion boolean, actualizado_en timestamptz
)
language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
-- Los parametros OUT (id, nombre...) colisionan con las columnas homonimas.
#variable_conflict use_column
declare
  v_yo uuid := (select auth.uid());
  v_punto extensions.geography;
begin
  if v_yo is null then raise exception 'no autenticado' using errcode = '28000'; end if;

  if p_lat is not null and p_lng is not null then
    if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
      raise exception 'coordenadas fuera de rango' using errcode = '22023';
    end if;
    v_punto := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  return query
  insert into public.perfiles as p (id, nombre, edad, bio, preferencia_consumo, coordenadas)
  values (v_yo, btrim(p_nombre), p_edad,
          nullif(btrim(coalesce(p_bio, '')), ''), p_preferencia, v_punto)
  on conflict (id) do update set
    nombre = excluded.nombre,
    edad = excluded.edad,
    bio = excluded.bio,
    preferencia_consumo = excluded.preferencia_consumo,
    coordenadas = coalesce(excluded.coordenadas, p.coordenadas)
  returning p.id, p.nombre, p.edad, p.bio, p.preferencia_consumo,
            (p.coordenadas is not null), p.actualizado_en;
end; $$;
revoke execute on function public.guardar_perfil(text, int, text, public.preferencia_consumo, double precision, double precision) from public, anon;
grant execute on function public.guardar_perfil(text, int, text, public.preferencia_consumo, double precision, double precision) to authenticated;
