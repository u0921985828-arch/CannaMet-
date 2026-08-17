-- Se ELIMINA la firma antigua para no dejar dos puertas, una sin verificacion.
drop function if exists public.guardar_perfil(
  text, int, text, public.preferencia_consumo, double precision, double precision);

create or replace function public.guardar_perfil(
  p_nombre text,
  p_fecha_nacimiento date,
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

  -- El corte de edad se comprueba AQUI, no solo en el formulario.
  if v_edad < 18 then
    raise exception 'MATCH es solo para mayores de 18 anos' using errcode = '22023'; end if;
  if v_edad > 120 then
    raise exception 'revisa la fecha de nacimiento' using errcode = '22023'; end if;

  -- Sin consentimiento vigente no se crea ni se actualiza el perfil.
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
    (id, nombre, edad, fecha_nacimiento, bio, preferencia_consumo, coordenadas)
  values (v_yo, btrim(p_nombre), v_edad, p_fecha_nacimiento,
          nullif(btrim(coalesce(p_bio,'')), ''), p_preferencia, v_punto)
  on conflict (id) do update set
    nombre = excluded.nombre, edad = excluded.edad,
    fecha_nacimiento = excluded.fecha_nacimiento, bio = excluded.bio,
    preferencia_consumo = excluded.preferencia_consumo,
    coordenadas = coalesce(excluded.coordenadas, p.coordenadas)
  returning p.id, p.nombre, p.edad, p.bio, p.preferencia_consumo,
            (p.coordenadas is not null), p.actualizado_en;
end; $$;

revoke execute on function public.guardar_perfil(
  text, date, text, public.preferencia_consumo, double precision, double precision)
  from public, anon;
grant execute on function public.guardar_perfil(
  text, date, text, public.preferencia_consumo, double precision, double precision)
  to authenticated;

-- Sin esto, `edad` se congela en el valor del alta.
create or replace function public.recalcular_edades()
returns int language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_filas int;
begin
  update public.perfiles set edad = public.edad_de(fecha_nacimiento)
  where fecha_nacimiento is not null and edad <> public.edad_de(fecha_nacimiento);
  get diagnostics v_filas = row_count;
  return v_filas;
end; $$;

revoke execute on function public.recalcular_edades() from public, anon, authenticated;

select cron.schedule('recalcular-edades', '30 3 * * *',
  $CRON$select public.recalcular_edades();$CRON$);
