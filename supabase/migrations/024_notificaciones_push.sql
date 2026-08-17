-- Notificaciones push. Hasta ahora una suspension o una apelacion resuelta solo
-- se veian al abrir la app.
--
-- Tres decisiones que explican la forma de todo lo demas:
--
-- 1. COLA, NO ENVIO DIRECTO. El trigger escribe una fila y termina. Si el envio
--    se hiciera dentro de la transaccion, un corte de red en Expo bloquearia el
--    INSERT del mensaje: la app dejaria de funcionar porque falla el aviso.
--
-- 2. EL CUERPO NO LLEVA EL MENSAJE. "Tienes un mensaje de Ana", nunca su texto.
--    El push viaja por APNs/FCM y se pinta en la pantalla de bloqueo; copiar ahi
--    el contenido tira por tierra el resto de cuidado con los datos.
--
-- 3. EL TOKEN ES LA CLAVE PRIMARIA. Un movil reinstalado por otra persona
--    reutiliza el token: si la clave fuera (usuario, token), el aparato acabaria
--    recibiendo los avisos de su dueno anterior.

begin;

create type public.plataforma_dispositivo as enum ('ios', 'android', 'web');

create type public.tipo_notificacion as enum (
  'mensaje', 'match', 'suspension', 'apelacion'
);

create table public.dispositivos (
  token      text primary key check (char_length(token) between 10 and 200),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  plataforma public.plataforma_dispositivo not null,
  creado_en  timestamptz not null default now(),
  visto_en   timestamptz not null default now()
);

create index dispositivos_usuario_idx on public.dispositivos (usuario_id);

alter table public.dispositivos enable row level security;

comment on table public.dispositivos is
  'Un token de Expo por aparato. Se escribe solo via RPC; el cliente nunca hace INSERT.';

create table public.notificaciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo       public.tipo_notificacion not null,
  titulo     text not null,
  cuerpo     text not null,
  datos      jsonb not null default '{}'::jsonb,
  creado_en  timestamptz not null default now(),
  -- "cerrado" y no "enviado": una fila tambien sale de la cola descartada, y
  -- llamar a eso enviado seria mentir en la unica traza que queda del aviso.
  cerrado_en timestamptz,
  intentos   int not null default 0,
  error      text
);

-- La cola de trabajo pendiente: el indice parcial la mantiene pequena aunque la
-- tabla crezca con el historico de enviadas.
create index notificaciones_pendientes_idx on public.notificaciones (creado_en asc)
  where cerrado_en is null;
create index notificaciones_usuario_idx on public.notificaciones (usuario_id, creado_en desc);

alter table public.notificaciones enable row level security;

-- ─────────────────────────── ALTA Y BAJA DE APARATOS ───────────────────────────

create or replace function public.registrar_dispositivo(
  p_token      text,
  p_plataforma public.plataforma_dispositivo
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_yo uuid := (select auth.uid());
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  -- El UPDATE del conflicto cambia tambien el dueno: ver decision 3 arriba.
  insert into public.dispositivos (token, usuario_id, plataforma)
  values (btrim(p_token), v_yo, p_plataforma)
  on conflict (token) do update set
    usuario_id = excluded.usuario_id,
    plataforma = excluded.plataforma,
    visto_en   = now();
end;
$$;

create or replace function public.olvidar_dispositivo(p_token text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_yo uuid := (select auth.uid());
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  delete from public.dispositivos
  where token = btrim(p_token) and usuario_id = v_yo;
end;
$$;

-- ──────────────────────────── TRIGGERS QUE ENCOLAN ────────────────────────────

-- Mensaje nuevo. Respeta el bloqueo y no apila: si ya hay un aviso sin enviar de
-- esa misma conversacion, veinte mensajes seguidos siguen siendo un push.
create or replace function public.tg_notificar_mensaje()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_destino uuid;
  v_nombre  text;
begin
  select case when m.usuario_1_id = new.remitente_id then m.usuario_2_id
              else m.usuario_1_id end
    into v_destino
  from public.matches m
  where m.id = new.match_id
    and not exists (
      select 1 from public.bloqueos b
      where (b.bloqueador_id = m.usuario_1_id and b.bloqueado_id = m.usuario_2_id)
         or (b.bloqueador_id = m.usuario_2_id and b.bloqueado_id = m.usuario_1_id)
    );

  if v_destino is null then return new; end if;

  if exists (
    select 1 from public.notificaciones
    where usuario_id = v_destino and tipo = 'mensaje' and cerrado_en is null
      and datos->>'match_id' = new.match_id::text
  ) then
    return new;
  end if;

  select nombre into v_nombre from public.perfiles where id = new.remitente_id;

  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, datos)
  values (v_destino, 'mensaje', coalesce(v_nombre, 'Alguien'),
          'Te ha escrito.',
          jsonb_build_object('match_id', new.match_id,
                             'otro_id', new.remitente_id,
                             'nombre', coalesce(v_nombre, 'Alguien')));
  return new;
end;
$$;

create trigger mensajes_notificar
  after insert on public.mensajes
  for each row execute function public.tg_notificar_mensaje();

-- Match nuevo: aviso a las dos partes, porque ninguna de las dos sabe que el
-- like era reciproco hasta este momento.
create or replace function public.tg_notificar_match()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n1 text;
  v_n2 text;
begin
  select nombre into v_n1 from public.perfiles where id = new.usuario_1_id;
  select nombre into v_n2 from public.perfiles where id = new.usuario_2_id;

  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, datos)
  values
    (new.usuario_1_id, 'match', 'Match', coalesce(v_n2, 'Alguien') || ' tambien te ha dado like.',
     jsonb_build_object('match_id', new.id, 'otro_id', new.usuario_2_id,
                        'nombre', coalesce(v_n2, 'Alguien'))),
    (new.usuario_2_id, 'match', 'Match', coalesce(v_n1, 'Alguien') || ' tambien te ha dado like.',
     jsonb_build_object('match_id', new.id, 'otro_id', new.usuario_1_id,
                        'nombre', coalesce(v_n1, 'Alguien')));
  return new;
end;
$$;

create trigger matches_notificar
  after insert on public.matches
  for each row execute function public.tg_notificar_match();

-- Suspension y levantamiento. Enterarse de que te han sancionado al intentar
-- entrar es peor que enterarse en el momento, y ademas retrasa la apelacion.
create or replace function public.tg_notificar_suspension()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.suspendido_hasta is not null
     and new.suspendido_hasta > now()
     and (old.suspendido_hasta is null or old.suspendido_hasta <> new.suspendido_hasta) then
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, datos)
    values (new.id, 'suspension', 'Cuenta suspendida',
            'Abre MATCH para ver el motivo y apelar si no estas de acuerdo.',
            jsonb_build_object('hasta', new.suspendido_hasta));

  elsif old.suspendido_hasta is not null and new.suspendido_hasta is null then
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, datos)
    values (new.id, 'suspension', 'Cuenta restablecida',
            'Ya puedes volver a usar MATCH.', '{}'::jsonb);
  end if;

  return new;
end;
$$;

create trigger perfiles_notificar_suspension
  after update of suspendido_hasta on public.perfiles
  for each row execute function public.tg_notificar_suspension();

-- Apelacion resuelta. La aceptada ya avisa por la via de la suspension
-- levantada; esta existe sobre todo para la rechazada, que si no no se comunica.
create or replace function public.tg_notificar_apelacion()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.estado = 'rechazada' and old.estado = 'pendiente' then
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, datos)
    values (new.usuario_id, 'apelacion', 'Apelacion revisada',
            'Hemos revisado tu apelacion. Abre MATCH para ver la respuesta.',
            '{}'::jsonb);
  end if;
  return new;
end;
$$;

create trigger apelaciones_notificar
  after update of estado on public.apelaciones
  for each row execute function public.tg_notificar_apelacion();

-- ────────────────────────── DRENAJE DE LA COLA ──────────────────────────
-- Reclamar y marcar son dos pasos separados a proposito: entre el envio a Expo
-- y la confirmacion hay una llamada de red que puede fallar, y un aviso perdido
-- es preferible a uno duplicado cada minuto.

create or replace function public.notificaciones_reclamar(p_limite int default 100)
returns table (
  id uuid, usuario_id uuid, tipo public.tipo_notificacion,
  titulo text, cuerpo text, datos jsonb, tokens text[]
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- Sin ningun aparato dado de alta no hay nada que enviar nunca: esas filas
  -- salen de la cola aqui en vez de gastar cinco intentos cada una.
  update public.notificaciones n
  set cerrado_en = now(), error = 'sin dispositivos'
  where n.cerrado_en is null
    and not exists (
      select 1 from public.dispositivos d where d.usuario_id = n.usuario_id
    );

  return query
  with elegidas as (
    select n.id from public.notificaciones n
    where n.cerrado_en is null and n.intentos < 5
    order by n.creado_en
    limit least(greatest(p_limite, 1), 500)
    for update skip locked
  ),
  marcadas as (
    update public.notificaciones n
    set intentos = n.intentos + 1
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

create or replace function public.notificaciones_marcar(
  p_ids   uuid[],
  p_error text default null
)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update public.notificaciones
  set cerrado_en = case when p_error is null then now() else cerrado_en end,
      error      = p_error
  where id = any(p_ids);
$$;

-- Expo responde 'DeviceNotRegistered' cuando la app se desinstalo. Guardar ese
-- token es acumular basura y gastar una peticion por aviso para siempre.
create or replace function public.dispositivos_baja(p_tokens text[])
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  delete from public.dispositivos where token = any(p_tokens);
$$;

-- El cron no envia: despierta a la Edge Function, que es quien habla con Expo.
-- La URL y la clave viven en Vault y no en el cuerpo de la funcion.
create or replace function public.notificaciones_despachar()
returns void
language plpgsql security definer
set search_path = public, net, vault, pg_temp
as $$
declare
  v_url   text;
  v_clave text;
begin
  if not exists (
    select 1 from public.notificaciones where cerrado_en is null and intentos < 5
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

-- ──────────────────────────────── PERMISOS ────────────────────────────────

-- Ni lectura: el cliente no tiene nada que hacer en estas dos tablas, todo
-- pasa por RPC. La RLS sin politicas ya lo impide; esto lo impide antes.
revoke all on public.dispositivos, public.notificaciones from anon, authenticated;

revoke execute on function
  public.registrar_dispositivo(text, public.plataforma_dispositivo),
  public.olvidar_dispositivo(text),
  public.notificaciones_reclamar(int),
  public.notificaciones_marcar(uuid[], text),
  public.dispositivos_baja(text[]),
  public.notificaciones_despachar(),
  public.tg_notificar_mensaje(),
  public.tg_notificar_match(),
  public.tg_notificar_suspension(),
  public.tg_notificar_apelacion()
  from public, anon, authenticated;

grant execute on function
  public.registrar_dispositivo(text, public.plataforma_dispositivo),
  public.olvidar_dispositivo(text)
  to authenticated;

-- Solo la Edge Function, que entra con service_role, drena la cola.
grant execute on function
  public.notificaciones_reclamar(int),
  public.notificaciones_marcar(uuid[], text),
  public.dispositivos_baja(text[])
  to service_role;


-- ─────────────────────── RGPD: ACCESO Y CONSERVACION ───────────────────────
-- Los aparatos y los avisos tambien son datos personales de quien los recibe.
-- Se anaden al export del art. 15 y a la purga del art. 5.1.e. El token no se
-- exporta: es un identificador de aparato, y devolverlo no informa de nada.

create or replace function public.exportar_mis_datos()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'generado_en', now(),
    'perfil', (
      select to_jsonb(x) from (
        select p.id, p.nombre, p.edad, p.bio, p.ambiente,
               (p.coordenadas is not null) as tiene_ubicacion,
               p.creado_en, p.actualizado_en, p.suspendido_hasta, p.suspension_motivo
        from public.perfiles p where p.id = (select auth.uid())
      ) x
    ),
    'swipes_emitidos', (
      select coalesce(count(*), 0) from public.swipes
      where usuario_origen_id = (select auth.uid())
    ),
    'matches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'con', o.nombre, 'desde', m.creado_en)), '[]'::jsonb)
      from public.matches m
      join public.perfiles o on o.id = case
        when m.usuario_1_id = (select auth.uid()) then m.usuario_2_id
        else m.usuario_1_id end
      where (select auth.uid()) in (m.usuario_1_id, m.usuario_2_id)
    ),
    'mensajes_enviados', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'contenido', contenido, 'enviado_en', creado_en) order by creado_en), '[]'::jsonb)
      from public.mensajes where remitente_id = (select auth.uid())
    ),
    'bloqueos_realizados', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nombre', p.nombre, 'fecha', b.creado_en)), '[]'::jsonb)
      from public.bloqueos b join public.perfiles p on p.id = b.bloqueado_id
      where b.bloqueador_id = (select auth.uid())
    ),
    'reportes_emitidos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'sobre', reportado_nombre, 'motivo', motivo,
        'detalle', detalle, 'fecha', creado_en, 'estado', estado)), '[]'::jsonb)
      from public.reportes where reportante_id = (select auth.uid())
    ),
    'apelaciones', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'texto', texto, 'estado', estado, 'fecha', creado_en)), '[]'::jsonb)
      from public.apelaciones where usuario_id = (select auth.uid())
    ),
    'dispositivos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'plataforma', plataforma, 'alta', creado_en, 'visto', visto_en)), '[]'::jsonb)
      from public.dispositivos where usuario_id = (select auth.uid())
    ),
    'notificaciones_recibidas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', tipo, 'titulo', titulo, 'fecha', creado_en) order by creado_en), '[]'::jsonb)
      from public.notificaciones where usuario_id = (select auth.uid())
    )
  );
$$;

create or replace function public.purgar_reportes_antiguos()
returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_dias     int := (public.cfg()).dias_retencion_reportes;
  v_borrados int;
begin
  with borrados as (
    delete from public.reportes
    where estado <> 'pendiente' and resuelto_en is not null
      and resuelto_en < now() - make_interval(days => v_dias)
    returning 1
  )
  select count(*)::int into v_borrados from borrados;

  delete from public.apelaciones
  where estado <> 'pendiente' and resuelta_en is not null
    and resuelta_en < now() - make_interval(days => v_dias);

  -- Un aviso caducado no le sirve ya a nadie: 30 dias es margen de sobra para
  -- diagnosticar un fallo de entrega, y guardarlos mas seria acumular por acumular.
  delete from public.notificaciones
  where creado_en < now() - interval '30 days';

  return v_borrados;
end;
$$;

select cron.schedule('despachar-notificaciones', '* * * * *',
  $CRON$select public.notificaciones_despachar();$CRON$);

commit;

-- =============================================================================
-- PASOS MANUALES
-- =============================================================================
--   create extension if not exists pg_net;
--
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/notificar', 'url_funcion_notificar');
--   select vault.create_secret('<service_role key>', 'clave_service_role');
--
--   supabase functions deploy notificar
-- =============================================================================
