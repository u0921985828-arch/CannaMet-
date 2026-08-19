-- Los cinco intentos de un aviso se gastaban en cinco minutos seguidos, porque
-- el cron dispara cada minuto y no habia memoria de cuando fue el ultimo. Una
-- caida de Expo de seis minutos —que no es nada— agotaba los intentos y perdia
-- el aviso para siempre, ademas de dejar la fila abierta en el indice de
-- pendientes hasta la purga de los 30 dias.
--
-- Con espera cuadratica (1, 4, 9, 16 minutos) los mismos cinco intentos cubren
-- media hora larga. No hace falta mas: si Expo lleva media hora caido, el aviso
-- ya no le sirve a nadie.

begin;

alter table public.notificaciones
  add column if not exists intentado_en timestamptz;

comment on column public.notificaciones.intentado_en is
  'Ultimo intento de entrega. Gobierna la espera entre reintentos.';

create or replace function public.notificaciones_reclamar(p_limite int default 100)
returns table (
  id uuid, usuario_id uuid, tipo public.tipo_notificacion,
  titulo text, cuerpo text, datos jsonb, tokens text[]
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.notificaciones n
  set cerrado_en = now(), error = 'sin dispositivos'
  where n.cerrado_en is null
    and not exists (
      select 1 from public.dispositivos d where d.usuario_id = n.usuario_id
    );

  return query
  with elegidas as (
    select n.id from public.notificaciones n
    where n.cerrado_en is null
      and n.intentos < 5
      and (n.intentado_en is null
           or n.intentado_en < now() - make_interval(mins => n.intentos * n.intentos))
    order by n.creado_en
    limit least(greatest(p_limite, 1), 500)
    for update skip locked
  ),
  marcadas as (
    update public.notificaciones n
    set intentos = n.intentos + 1, intentado_en = now()
    from elegidas e where n.id = e.id
    returning n.id, n.usuario_id, n.tipo, n.titulo, n.cuerpo, n.datos
  )
  select m.id, m.usuario_id, m.tipo, m.titulo, m.cuerpo, m.datos,
         coalesce(array_agg(d.token) filter (where d.token is not null), '{}')
  from marcadas m
  left join public.dispositivos d on d.usuario_id = m.usuario_id
  group by m.id, m.usuario_id, m.tipo, m.titulo, m.cuerpo, m.datos;
end;
$$;

-- Misma condicion que el reclamo: si todo lo pendiente esta esperando, no tiene
-- sentido despertar a la Edge Function para que no haga nada.
create or replace function public.notificaciones_despachar()
returns void
language plpgsql security definer
set search_path = public, extensions, net, vault, pg_temp
as $$
declare
  v_url   text;
  v_clave text;
begin
  if not exists (
    select 1 from public.notificaciones n
    where n.cerrado_en is null
      and n.intentos < 5
      and (n.intentado_en is null
           or n.intentado_en < now() - make_interval(mins => n.intentos * n.intentos))
  ) then
    return;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'url_funcion_notificar';
  select decrypted_secret into v_clave
  from vault.decrypted_secrets where name = 'clave_service_role';

  if v_url is null or v_clave is null then
    raise warning 'notificaciones: faltan los secretos en Vault, no se despacha';
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_clave),
    body    := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
end;
$$;

revoke execute on function
  public.notificaciones_reclamar(int),
  public.notificaciones_despachar()
  from public, anon, authenticated;

grant execute on function public.notificaciones_reclamar(int) to service_role;

commit;
