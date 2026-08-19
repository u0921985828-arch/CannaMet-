-- =============================================================================
-- CannaMet — esquema canónico
-- =============================================================================
-- Reconstruye la base entera desde una instancia Supabase limpia.
-- Extraído del catálogo del proyecto en producción, no de las migraciones:
-- si `supabase/migrations/` y este fichero difieren, manda este fichero.
--
--   psql "$DATABASE_URL" -f supabase/schema.sql
--
-- Las migraciones numeradas quedan como historial de decisiones; para
-- levantar un entorno nuevo se usa solo este archivo.
-- =============================================================================

begin;

-- ─────────────────────────────── EXTENSIONES ───────────────────────────────

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;
-- pg_net: el cron despierta a la Edge Function que entrega los avisos push.
-- `with schema extensions` no es cosmetico: sin el, la extension queda
-- registrada en `public`, que es justo lo que el linter de Supabase señala.
-- Sus funciones viven en el esquema `net` en cualquier caso.
create extension if not exists pg_net with schema extensions;

-- ──────────────────────────────── ENUMERADOS ────────────────────────────────

create type public.accion_swipe as enum ('like', 'dislike');

-- Contexto para quedar. No declara consumo de ninguna sustancia y por tanto
-- no es categoría especial de datos (art. 9 RGPD).
create type public.ambiente_preferido as enum (
  'casa', 'monte', 'musica', 'quedadas', 'crear', 'prefiero_no_decir'
);

create type public.motivo_reporte as enum (
  'menor_de_edad', 'acoso_o_amenazas', 'contenido_sexual',
  'perfil_falso', 'spam_o_estafa', 'bloqueos_repetidos', 'otro'
);

create type public.origen_reporte as enum ('usuario', 'automatico');
create type public.estado_reporte as enum ('pendiente', 'revisado', 'actuado', 'descartado');
create type public.estado_apelacion as enum ('pendiente', 'aceptada', 'rechazada');

create type public.plataforma_dispositivo as enum ('ios', 'android', 'web');
create type public.tipo_notificacion as enum (
  'mensaje', 'match', 'suspension', 'apelacion'
);

-- ───────────────────────────── CONFIGURACIÓN ─────────────────────────────
-- Fila única. Los umbrales viven aquí y no en el cuerpo de las funciones:
-- sin datos reales son una conjetura y hay que poder ajustarlos sin migrar.

create table public.config_moderacion (
  id                        boolean primary key default true check (id),
  bloqueos_para_senal       int  not null default 3   check (bloqueos_para_senal between 2 and 50),
  ventana_senal_dias        int  not null default 30  check (ventana_senal_dias between 1 and 365),
  horas_cuenta_nueva        int  not null default 24  check (horas_cuenta_nueva between 0 and 720),
  cuota_swipes_cuenta_nueva int  not null default 30  check (cuota_swipes_cuenta_nueva between 1 and 1000),
  max_reportes_por_hora     int  not null default 10  check (max_reportes_por_hora between 1 and 100),
  dias_retencion_reportes   int  not null default 180 check (dias_retencion_reportes between 30 and 3650),
  version_terminos          text not null default '2026-08-2',
  version_privacidad        text not null default '2026-08-2',
  actualizado_en            timestamptz not null default now()
);

insert into public.config_moderacion default values;

alter table public.config_moderacion enable row level security;

comment on table public.config_moderacion is
  'Fila única. Editable con service_role desde el dashboard, sin migración.';

create or replace function public.cfg()
returns public.config_moderacion
language sql stable security definer
set search_path = public, pg_temp
as $$ select * from public.config_moderacion where id; $$;

-- ─────────────────────────────── MODERADORES ───────────────────────────────
-- Tabla aparte y no un booleano en `perfiles`: el rol no debe viajar nunca
-- en la misma fila que se sirve a otras personas usuarias.

create table public.moderadores (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  creado_en  timestamptz not null default now(),
  nota       text
);

alter table public.moderadores enable row level security;

comment on table public.moderadores is
  'Alta solo con service_role. Ningún cliente puede leer ni escribir aquí.';

create or replace function public.soy_moderador()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.moderadores where usuario_id = (select auth.uid()));
$$;

-- ───────────────────────────────── PERFILES ─────────────────────────────────

-- STABLE y no IMMUTABLE: la funcion lee `current_date`, asi que su resultado
-- cambia cada dia. Marcarla immutable seria mentirle al planificador, que puede
-- plegarla a constante en un plan cacheado y congelar ahi la edad — justo lo que
-- el cron de las 03:30 existe para evitar.
create or replace function public.edad_de(p_fecha date)
returns int
language sql stable
set search_path = pg_catalog, pg_temp
as $$ select extract(year from age(current_date, p_fecha))::int; $$;

create table public.perfiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  nombre            text not null check (char_length(btrim(nombre)) between 2 and 40),
  edad              int  not null check (edad between 18 and 120),
  fecha_nacimiento  date,
  bio               text check (char_length(bio) <= 500),
  -- Ruta dentro del bucket `fotos`, con la forma <uid>/<fichero>. Nunca una
  -- URL: las firmadas caducan y guardar una seria guardar basura.
  foto              text check (foto is null or foto ~ '^[0-9a-f-]{36}/[a-zA-Z0-9._-]{1,80}$'),
  ambiente          public.ambiente_preferido not null default 'prefiero_no_decir',
  coordenadas       extensions.geography(Point, 4326),
  suspendido_hasta  timestamptz,
  suspension_motivo text,
  suspendido_por    uuid references auth.users(id) on delete set null,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint perfiles_mayor_de_edad check (
    fecha_nacimiento is null
    or (fecha_nacimiento <= current_date - interval '18 years'
        and fecha_nacimiento >= current_date - interval '120 years')
  )
);

create index perfiles_coordenadas_idx on public.perfiles using gist (coordenadas);
create index perfiles_suspendidos_idx on public.perfiles (suspendido_hasta)
  where suspendido_hasta is not null;

alter table public.perfiles enable row level security;

comment on column public.perfiles.coordenadas is
  'Nunca sale al cliente. El descubrimiento devuelve distancia, no el punto.';
comment on column public.perfiles.fecha_nacimiento is
  'Fuente de verdad de la edad. `edad` se deriva en cada guardado y a diario.';
comment on column public.perfiles.suspendido_por is
  'Impide que quien sanciona resuelva su propia apelación.';

create or replace function public.tg_set_actualizado_en()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$ begin new.actualizado_en := now(); return new; end; $$;

create trigger perfiles_set_actualizado_en
  before update on public.perfiles
  for each row execute function public.tg_set_actualizado_en();

-- ────────────────────────────────── SWIPES ──────────────────────────────────

create table public.swipes (
  id                 uuid primary key default gen_random_uuid(),
  usuario_origen_id  uuid not null references public.perfiles(id) on delete cascade,
  usuario_destino_id uuid not null references public.perfiles(id) on delete cascade,
  accion             public.accion_swipe not null,
  creado_en          timestamptz not null default now(),
  constraint swipes_no_autoswipe check (usuario_origen_id <> usuario_destino_id),
  constraint swipes_unicos unique (usuario_origen_id, usuario_destino_id)
);

create index swipes_destino_accion_idx on public.swipes (usuario_destino_id, accion);

alter table public.swipes enable row level security;

-- ────────────────────────────────── MATCHES ──────────────────────────────────
-- Orden canónico usuario_1_id < usuario_2_id: el duplicado A-B / B-A es
-- imposible por constraint, no por lógica de aplicación.

create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  usuario_1_id uuid not null references public.perfiles(id) on delete cascade,
  usuario_2_id uuid not null references public.perfiles(id) on delete cascade,
  creado_en    timestamptz not null default now(),
  constraint matches_orden_canonico check (usuario_1_id < usuario_2_id),
  constraint matches_unicos unique (usuario_1_id, usuario_2_id)
);

create index matches_usuario_2_idx on public.matches (usuario_2_id);

alter table public.matches enable row level security;

-- ───────────────────────────────── MENSAJES ─────────────────────────────────

create table public.mensajes (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches(id) on delete cascade,
  remitente_id uuid not null references public.perfiles(id) on delete cascade,
  contenido    text not null check (char_length(btrim(contenido)) between 1 and 2000),
  leido        boolean not null default false,
  -- clock_timestamp() y no now(): now() es el instante de la TRANSACCIÓN, y dos
  -- mensajes insertados juntos compartirían sello dejando el orden indefinido.
  creado_en    timestamptz not null default clock_timestamp()
);

create index mensajes_orden_idx on public.mensajes (match_id, creado_en desc, id desc);
create index mensajes_no_leidos_idx on public.mensajes (match_id, remitente_id)
  where leido = false;

alter table public.mensajes enable row level security;
alter table public.mensajes replica identity full;

-- ───────────────────────────────── BLOQUEOS ─────────────────────────────────

create table public.bloqueos (
  id            uuid primary key default gen_random_uuid(),
  bloqueador_id uuid not null references public.perfiles(id) on delete cascade,
  bloqueado_id  uuid not null references public.perfiles(id) on delete cascade,
  creado_en     timestamptz not null default now(),
  constraint bloqueos_no_autobloqueo check (bloqueador_id <> bloqueado_id),
  constraint bloqueos_unicos unique (bloqueador_id, bloqueado_id)
);

create index bloqueos_bloqueado_idx on public.bloqueos (bloqueado_id, bloqueador_id);

alter table public.bloqueos enable row level security;

-- ───────────────────────────────── REPORTES ─────────────────────────────────
-- Ambos extremos son NULLABLE con ON DELETE SET NULL a propósito: la denuncia
-- debe sobrevivir tanto a quien la puso como a quien la recibió. Borrarse no
-- puede limpiar el expediente de nadie ni cancelar una revisión abierta.

create table public.reportes (
  id               uuid primary key default gen_random_uuid(),
  reportante_id    uuid references public.perfiles(id) on delete set null,
  reportado_id     uuid references public.perfiles(id) on delete set null,
  reportado_nombre text,
  motivo           public.motivo_reporte not null,
  origen           public.origen_reporte not null default 'usuario',
  detalle          text check (char_length(detalle) <= 1000),
  estado           public.estado_reporte not null default 'pendiente',
  creado_en        timestamptz not null default now(),
  resuelto_por     uuid references auth.users(id) on delete set null,
  resuelto_en      timestamptz,
  nota_moderacion  text,
  constraint reportes_no_autoreporte check (reportante_id <> reportado_id)
);

create index reportes_pendientes_idx on public.reportes (creado_en desc)
  where estado = 'pendiente';
create index reportes_reportado_idx on public.reportes (reportado_id);

alter table public.reportes enable row level security;

comment on column public.reportes.reportante_id is
  'NULL si el denunciante borró su cuenta, o si origen = automatico.';

-- ──────────────────────────────── APELACIONES ────────────────────────────────

create table public.apelaciones (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references public.perfiles(id) on delete cascade,
  texto           text not null check (char_length(btrim(texto)) between 10 and 1000),
  estado          public.estado_apelacion not null default 'pendiente',
  creado_en       timestamptz not null default now(),
  resuelta_por    uuid references auth.users(id) on delete set null,
  resuelta_en     timestamptz,
  nota_moderacion text
);

-- Una pendiente por persona: apelar en bucle es otra forma de spam.
create unique index apelaciones_una_pendiente on public.apelaciones (usuario_id)
  where estado = 'pendiente';
create index apelaciones_cola_idx on public.apelaciones (creado_en asc)
  where estado = 'pendiente';

alter table public.apelaciones enable row level security;

-- ───────────────────────── ACEPTACIONES LEGALES ─────────────────────────
-- El RGPD exige poder DEMOSTRAR el consentimiento (art. 7.1), no solo obtenerlo.
-- Histórico inmutable: cada versión aceptada deja su propia fila. Sin IP, que
-- sería un dato personal extra que no necesitamos.

create table public.aceptaciones_legales (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users(id) on delete cascade,
  version_terminos   text not null,
  version_privacidad text not null,
  acepta_datos_salud boolean not null default false,
  aceptado_en        timestamptz not null default now()
);

create index aceptaciones_usuario_idx
  on public.aceptaciones_legales (usuario_id, aceptado_en desc);

alter table public.aceptaciones_legales enable row level security;

comment on column public.aceptaciones_legales.acepta_datos_salud is
  'OBSOLETO desde 2026-08-2: el perfil ya no recoge datos de salud. Se conserva '
  'como histórico de consentimientos anteriores.';

-- ─────────────────────── APARATOS Y COLA DE AVISOS ───────────────────────
-- El trigger encola y termina; nadie envía nada dentro de la transacción. Si el
-- envío viviera ahí, un corte de red en Expo bloquearía el INSERT del mensaje.

create table public.dispositivos (
  -- El token es la clave: un móvil reinstalado por otra persona lo reutiliza, y
  -- con clave (usuario, token) el aparato acabaría recibiendo los avisos del
  -- dueño anterior.
  token      text primary key check (char_length(token) between 10 and 200),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  plataforma public.plataforma_dispositivo not null,
  creado_en  timestamptz not null default now(),
  visto_en   timestamptz not null default now()
);

create index dispositivos_usuario_idx on public.dispositivos (usuario_id);

alter table public.dispositivos enable row level security;

comment on table public.dispositivos is
  'Un token de Expo por aparato. Solo se escribe vía RPC; el cliente no lee aquí.';

create table public.notificaciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo       public.tipo_notificacion not null,
  titulo     text not null,
  -- El cuerpo nunca lleva el texto del mensaje: el push se pinta en la pantalla
  -- de bloqueo, y copiarlo ahí tira por tierra el resto de cuidado con los datos.
  cuerpo     text not null,
  datos      jsonb not null default '{}'::jsonb,
  creado_en  timestamptz not null default now(),
  -- "cerrado" y no "enviado": una fila también sale de la cola descartada, y
  -- llamar a eso enviado sería mentir en la única traza que queda del aviso.
  cerrado_en timestamptz,
  intentos   int not null default 0,
  -- Sin recordar cuando fue el ultimo intento, los cinco se gastaban en cinco
  -- minutos seguidos y una caida corta de Expo perdia el aviso para siempre.
  intentado_en timestamptz,
  error      text
);

create index notificaciones_pendientes_idx on public.notificaciones (creado_en asc)
  where cerrado_en is null;
create index notificaciones_usuario_idx
  on public.notificaciones (usuario_id, creado_en desc);

alter table public.notificaciones enable row level security;

-- =============================================================================
-- FUNCIONES DE APOYO A LAS POLÍTICAS
-- =============================================================================

-- Un bloqueo es unilateral en intención pero simétrico en efecto.
create or replace function public.hay_bloqueo(p_otro_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.bloqueos b
    where (b.bloqueador_id = (select auth.uid()) and b.bloqueado_id = p_otro_id)
       or (b.bloqueador_id = p_otro_id and b.bloqueado_id = (select auth.uid()))
  );
$$;

-- Gobierna las tres políticas de `mensajes`: el bloqueo se propaga a lectura,
-- escritura y marcado de leídos desde un único punto.
create or replace function public.es_miembro_de_match(p_match_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (select auth.uid()) in (m.usuario_1_id, m.usuario_2_id)
      and not exists (
        select 1 from public.bloqueos b
        where (b.bloqueador_id = m.usuario_1_id and b.bloqueado_id = m.usuario_2_id)
           or (b.bloqueador_id = m.usuario_2_id and b.bloqueado_id = m.usuario_1_id)
      )
  );
$$;

-- Una cuenta recién creada no puede ABRIR conversación, solo responder: frena
-- la cuenta desechable que hace match y suelta un enlace de estafa.
create or replace function public.puede_escribir_en_match(p_match_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.es_miembro_de_match(p_match_id)
    and coalesce((select suspendido_hasta is null or suspendido_hasta <= now()
                  from public.perfiles where id = (select auth.uid())), false)
    and (
      coalesce((select creado_en <= now() - make_interval(hours => (public.cfg()).horas_cuenta_nueva)
                from public.perfiles where id = (select auth.uid())), false)
      or exists (select 1 from public.mensajes m
                 where m.match_id = p_match_id
                   and m.remitente_id <> (select auth.uid()))
    );
$$;

create or replace function public.estoy_suspendido()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select suspendido_hasta > now() from public.perfiles where id = (select auth.uid())),
    false);
$$;

create or replace function public.cuota_swipes_restante()
returns int
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when (select creado_en from public.perfiles where id = (select auth.uid()))
         > now() - make_interval(hours => (public.cfg()).horas_cuenta_nueva)
    then greatest(0, (public.cfg()).cuota_swipes_cuenta_nueva - (
      select count(*)::int from public.swipes
      where usuario_origen_id = (select auth.uid())
        and creado_en > now() - make_interval(hours => (public.cfg()).horas_cuenta_nueva)))
    else 2147483647
  end;
$$;

-- =============================================================================
-- POLÍTICAS RLS
-- =============================================================================

-- PERFILES ────────────────────────────────────────────────────────────────────
create policy perfiles_select_propio on public.perfiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy perfiles_select_match on public.perfiles
  for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where (m.usuario_1_id = perfiles.id and m.usuario_2_id = (select auth.uid()))
         or (m.usuario_2_id = perfiles.id and m.usuario_1_id = (select auth.uid()))
    )
    and not public.hay_bloqueo(perfiles.id)
  );

create policy perfiles_insert_propio on public.perfiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy perfiles_update_propio on public.perfiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy perfiles_delete_propio on public.perfiles
  for delete to authenticated
  using ((select auth.uid()) = id);

-- SWIPES ──────────────────────────────────────────────────────────────────────
-- Solo los propios: nunca puedes saber quién te dio like antes del match.
create policy swipes_select_propios on public.swipes
  for select to authenticated
  using ((select auth.uid()) = usuario_origen_id);

-- MATCHES ─────────────────────────────────────────────────────────────────────
create policy matches_select_propios on public.matches
  for select to authenticated
  using ((select auth.uid()) in (usuario_1_id, usuario_2_id));

-- MENSAJES ────────────────────────────────────────────────────────────────────
create policy mensajes_select_del_match on public.mensajes
  for select to authenticated
  using (public.es_miembro_de_match(match_id));

create policy mensajes_insert_propio on public.mensajes
  for insert to authenticated
  with check (
    (select auth.uid()) = remitente_id
    and public.puede_escribir_en_match(match_id)
  );

create policy mensajes_update_leido on public.mensajes
  for update to authenticated
  using (public.es_miembro_de_match(match_id) and remitente_id <> (select auth.uid()))
  with check (public.es_miembro_de_match(match_id) and remitente_id <> (select auth.uid()));

-- BLOQUEOS ────────────────────────────────────────────────────────────────────
create policy bloqueos_select_propios on public.bloqueos
  for select to authenticated
  using ((select auth.uid()) = bloqueador_id);

-- REPORTES ────────────────────────────────────────────────────────────────────
create policy reportes_select_propios on public.reportes
  for select to authenticated
  using ((select auth.uid()) = reportante_id);

create policy reportes_select_moderador on public.reportes
  for select to authenticated
  using (public.soy_moderador());

-- APELACIONES ─────────────────────────────────────────────────────────────────
create policy apelaciones_select_propias on public.apelaciones
  for select to authenticated
  using ((select auth.uid()) = usuario_id);

create policy apelaciones_select_moderador on public.apelaciones
  for select to authenticated
  using (public.soy_moderador());

-- ACEPTACIONES LEGALES ────────────────────────────────────────────────────────
create policy aceptaciones_select_propias on public.aceptaciones_legales
  for select to authenticated
  using ((select auth.uid()) = usuario_id);

-- =============================================================================
-- RPC DE APLICACIÓN
-- =============================================================================

-- Devuelve distancia en km, jamás las coordenadas del otro perfil.
create or replace function public.descubrir_perfiles(
  p_radio_km int default 50,
  p_limite   int default 20
)
returns table (
  id uuid, nombre text, edad int, bio text,
  ambiente public.ambiente_preferido, foto text, distancia_km numeric
)
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select p.id, p.nombre, p.edad, p.bio, p.ambiente, p.foto,
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

-- La reciprocidad se resuelve en servidor: el cliente no puede leer swipes ajenos.
create or replace function public.registrar_swipe(
  p_destino_id uuid,
  p_accion     public.accion_swipe
)
returns table (hay_match boolean, match_id uuid)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg              public.config_moderacion := public.cfg();
  v_yo               uuid := (select auth.uid());
  v_reciproco        boolean := false;
  v_match_id         uuid;
  v_suspendido_hasta timestamptz;
  v_creado_en        timestamptz;
  v_recientes        int;
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  if v_yo = p_destino_id then
    raise exception 'no puedes hacer swipe sobre ti mismo' using errcode = '22023';
  end if;

  select suspendido_hasta, creado_en into v_suspendido_hasta, v_creado_en
  from public.perfiles where id = v_yo;

  if v_creado_en is null then
    raise exception 'perfil no creado: completa el onboarding' using errcode = '22023';
  end if;
  if v_suspendido_hasta is not null and v_suspendido_hasta > now() then
    raise exception 'cuenta suspendida' using errcode = '28000';
  end if;

  if v_creado_en > now() - make_interval(hours => v_cfg.horas_cuenta_nueva) then
    select count(*) into v_recientes from public.swipes
    where usuario_origen_id = v_yo
      and creado_en > now() - make_interval(hours => v_cfg.horas_cuenta_nueva);

    if v_recientes >= v_cfg.cuota_swipes_cuenta_nueva then
      raise exception 'limite diario alcanzado para cuentas nuevas' using errcode = '54000';
    end if;
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
end;
$$;

create or replace function public.listar_matches()
returns table (
  match_id uuid, otro_id uuid, otro_nombre text, otro_edad int,
  otro_ambiente public.ambiente_preferido, otro_foto text,
  ultimo_mensaje text, ultimo_mensaje_en timestamptz,
  no_leidos bigint, creado_en timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.id, o.id, o.nombre, o.edad, o.ambiente, o.foto,
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

-- El corte de 18 años se comprueba aquí, no solo en el formulario.
-- `#variable_conflict use_column`: los parámetros OUT (id, nombre…) colisionan
-- con las columnas homónimas dentro del INSERT.
create or replace function public.guardar_perfil(
  p_nombre           text,
  p_fecha_nacimiento date,
  p_bio              text default null,
  p_ambiente         public.ambiente_preferido default 'prefiero_no_decir',
  p_lat              double precision default null,
  p_lng              double precision default null
)
returns table (
  id uuid, nombre text, edad int, bio text,
  ambiente public.ambiente_preferido,
  tiene_ubicacion boolean, actualizado_en timestamptz
)
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  v_yo    uuid := (select auth.uid());
  v_punto extensions.geography;
  v_edad  int;
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  if p_fecha_nacimiento is null then
    raise exception 'falta la fecha de nacimiento' using errcode = '22023';
  end if;

  v_edad := public.edad_de(p_fecha_nacimiento);
  if v_edad < 18 then
    raise exception 'CannaMet es solo para mayores de 18 anos' using errcode = '22023';
  end if;
  if v_edad > 120 then
    raise exception 'revisa la fecha de nacimiento' using errcode = '22023';
  end if;

  if not public.consentimiento_al_dia() then
    raise exception 'tienes que aceptar los terminos y la politica de privacidad'
      using errcode = '22023';
  end if;

  if p_lat is not null and p_lng is not null then
    if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
      raise exception 'coordenadas fuera de rango' using errcode = '22023';
    end if;
    v_punto := extensions.st_setsrid(
      extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  return query
  insert into public.perfiles as p
    (id, nombre, edad, fecha_nacimiento, bio, ambiente, coordenadas)
  values (v_yo, btrim(p_nombre), v_edad, p_fecha_nacimiento,
          nullif(btrim(coalesce(p_bio, '')), ''), p_ambiente, v_punto)
  on conflict (id) do update set
    nombre           = excluded.nombre,
    edad             = excluded.edad,
    fecha_nacimiento = excluded.fecha_nacimiento,
    bio              = excluded.bio,
    ambiente         = excluded.ambiente,
    coordenadas      = coalesce(excluded.coordenadas, p.coordenadas)
  returning p.id, p.nombre, p.edad, p.bio, p.ambiente,
            (p.coordenadas is not null), p.actualizado_en;
end;
$$;

-- Sin esto, `edad` se congela en el valor del alta.
create or replace function public.recalcular_edades()
returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_filas int;
begin
  update public.perfiles set edad = public.edad_de(fecha_nacimiento)
  where fecha_nacimiento is not null and edad <> public.edad_de(fecha_nacimiento);
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

-- =============================================================================
-- RPC DE MODERACIÓN
-- =============================================================================

-- Bloquear implica 'dislike': si no, el perfil reaparecería en el feed.
create or replace function public.bloquear_usuario(p_otro_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_yo uuid := (select auth.uid());
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  if v_yo = p_otro_id then
    raise exception 'no puedes bloquearte a ti mismo' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfiles where id = p_otro_id) then
    raise exception 'ese usuario no existe' using errcode = '22023';
  end if;

  insert into public.bloqueos (bloqueador_id, bloqueado_id)
  values (v_yo, p_otro_id)
  on conflict (bloqueador_id, bloqueado_id) do nothing;

  insert into public.swipes (usuario_origen_id, usuario_destino_id, accion)
  values (v_yo, p_otro_id, 'dislike')
  on conflict (usuario_origen_id, usuario_destino_id)
  do update set accion = 'dislike';
end;
$$;

create or replace function public.desbloquear_usuario(p_otro_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_yo uuid := (select auth.uid());
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  delete from public.bloqueos where bloqueador_id = v_yo and bloqueado_id = p_otro_id;
  -- El 'dislike' se mantiene: desbloquear no es volver a interesarse.
end;
$$;

create or replace function public.listar_bloqueados()
returns table (id uuid, nombre text, creado_en timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id, p.nombre, b.creado_en
  from public.bloqueos b
  join public.perfiles p on p.id = b.bloqueado_id
  where b.bloqueador_id = (select auth.uid())
  order by b.creado_en desc;
$$;

-- Reportar bloquea por defecto: nadie denuncia a alguien con quien quiere
-- seguir hablando.
create or replace function public.reportar_usuario(
  p_otro_id  uuid,
  p_motivo   public.motivo_reporte,
  p_detalle  text default null,
  p_bloquear boolean default true
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg        public.config_moderacion := public.cfg();
  v_yo         uuid := (select auth.uid());
  v_nombre     text;
  v_reporte_id uuid;
  v_recientes  int;
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  if v_yo = p_otro_id then
    raise exception 'no puedes reportarte a ti mismo' using errcode = '22023';
  end if;

  select nombre into v_nombre from public.perfiles where id = p_otro_id;
  if v_nombre is null then
    raise exception 'ese usuario no existe' using errcode = '22023';
  end if;

  -- La denuncia masiva es en sí misma una forma de acoso.
  select count(*) into v_recientes from public.reportes
  where reportante_id = v_yo and creado_en > now() - interval '1 hour';
  if v_recientes >= v_cfg.max_reportes_por_hora then
    raise exception 'demasiados reportes en poco tiempo, prueba mas tarde'
      using errcode = '54000';
  end if;

  insert into public.reportes
    (reportante_id, reportado_id, reportado_nombre, motivo, detalle)
  values (v_yo, p_otro_id, v_nombre, p_motivo,
          nullif(btrim(coalesce(p_detalle, '')), ''))
  returning id into v_reporte_id;

  if p_bloquear then perform public.bloquear_usuario(p_otro_id); end if;
  return v_reporte_id;
end;
$$;

-- Varias personas distintas bloqueando al mismo perfil es una señal, no una
-- coincidencia. Usa datos que ya existen: nadie denuncia nada extra.
create or replace function public.tg_senal_bloqueos_repetidos()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg       public.config_moderacion := public.cfg();
  v_distintos int;
  v_nombre    text;
begin
  select count(distinct bloqueador_id) into v_distintos
  from public.bloqueos
  where bloqueado_id = new.bloqueado_id
    and creado_en > now() - make_interval(days => v_cfg.ventana_senal_dias);

  if v_distintos < v_cfg.bloqueos_para_senal then
    return new;
  end if;

  -- No apilar señales mientras haya una sin revisar.
  if exists (
    select 1 from public.reportes
    where reportado_id = new.bloqueado_id
      and origen = 'automatico' and estado = 'pendiente'
  ) then
    return new;
  end if;

  select nombre into v_nombre from public.perfiles where id = new.bloqueado_id;

  insert into public.reportes
    (reportante_id, reportado_id, reportado_nombre, motivo, detalle, origen)
  values (null, new.bloqueado_id, v_nombre, 'bloqueos_repetidos',
          format('%s personas distintas han bloqueado a este perfil en %s dias.',
                 v_distintos, v_cfg.ventana_senal_dias),
          'automatico');
  return new;
end;
$$;

create trigger bloqueos_senal_automatica
  after insert on public.bloqueos
  for each row execute function public.tg_senal_bloqueos_repetidos();

-- Ordena por gravedad, no por fecha, y acompaña cada caso del contexto que
-- cambia la decisión: un reporte suelto y el décimo no son el mismo caso.
create or replace function public.moderacion_cola(p_limite int default 50)
returns table (
  id uuid, motivo public.motivo_reporte, origen public.origen_reporte,
  detalle text, creado_en timestamptz,
  reportado_id uuid, reportado_nombre text, reportado_existe boolean,
  reportado_foto text, reportado_suspendido_hasta timestamptz,
  veces_reportado bigint, veces_bloqueado bigint
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select r.id, r.motivo, r.origen, r.detalle, r.creado_en,
         r.reportado_id, r.reportado_nombre, (p.id is not null),
         p.foto, p.suspendido_hasta,
         (select count(*) from public.reportes r2 where r2.reportado_id = r.reportado_id),
         (select count(*) from public.bloqueos b where b.bloqueado_id = r.reportado_id)
  from public.reportes r
  left join public.perfiles p on p.id = r.reportado_id
  where public.soy_moderador() and r.estado = 'pendiente'
  order by (r.motivo = 'menor_de_edad') desc,
           (r.motivo = 'acoso_o_amenazas') desc,
           r.creado_en asc
  limit least(greatest(p_limite, 1), 200);
$$;

create or replace function public.moderacion_resolver(
  p_reporte_id     uuid,
  p_estado         public.estado_reporte,
  p_suspender_dias int default null,
  p_nota           text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_yo        uuid := (select auth.uid());
  v_reportado uuid;
begin
  if not public.soy_moderador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if p_estado = 'pendiente' then
    raise exception 'resolver exige un estado final' using errcode = '22023';
  end if;

  select reportado_id into v_reportado from public.reportes where id = p_reporte_id;

  update public.reportes
  set estado = p_estado, resuelto_por = v_yo, resuelto_en = now(),
      nota_moderacion = nullif(btrim(coalesce(p_nota, '')), '')
  where id = p_reporte_id;

  if p_suspender_dias is not null and v_reportado is not null then
    if p_suspender_dias < 1 or p_suspender_dias > 3650 then
      raise exception 'duracion de suspension fuera de rango' using errcode = '22023';
    end if;

    update public.perfiles
    set suspendido_hasta  = now() + make_interval(days => p_suspender_dias),
        suspension_motivo = nullif(btrim(coalesce(p_nota, '')), ''),
        suspendido_por    = v_yo
    where id = v_reportado;
  end if;
end;
$$;

create or replace function public.moderacion_levantar_suspension(p_usuario_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.soy_moderador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  update public.perfiles
  set suspendido_hasta = null, suspension_motivo = null, suspendido_por = null
  where id = p_usuario_id;
end;
$$;

-- =============================================================================
-- APELACIONES
-- =============================================================================

create or replace function public.apelar(p_texto text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_yo               uuid := (select auth.uid());
  v_suspendido_hasta timestamptz;
  v_id               uuid;
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  select suspendido_hasta into v_suspendido_hasta
  from public.perfiles where id = v_yo;

  if v_suspendido_hasta is null or v_suspendido_hasta <= now() then
    raise exception 'tu cuenta no esta suspendida' using errcode = '22023';
  end if;

  if exists (select 1 from public.apelaciones
             where usuario_id = v_yo and estado = 'pendiente') then
    raise exception 'ya tienes una apelacion pendiente de revisar' using errcode = '22023';
  end if;

  insert into public.apelaciones (usuario_id, texto)
  values (v_yo, btrim(p_texto))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.moderacion_apelaciones(p_limite int default 50)
returns table (
  id uuid, usuario_id uuid, nombre text, texto text, creado_en timestamptz,
  suspendido_hasta timestamptz, suspension_motivo text, puedo_resolver boolean
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select a.id, a.usuario_id, p.nombre, a.texto, a.creado_en,
         p.suspendido_hasta, p.suspension_motivo,
         (p.suspendido_por is null or p.suspendido_por <> (select auth.uid()))
  from public.apelaciones a
  join public.perfiles p on p.id = a.usuario_id
  where public.soy_moderador() and a.estado = 'pendiente'
  order by a.creado_en asc
  limit least(greatest(p_limite, 1), 200);
$$;

-- Revisar tu propia sanción no es una apelación, es una ratificación.
create or replace function public.moderacion_resolver_apelacion(
  p_apelacion_id uuid,
  p_aceptar      boolean,
  p_nota         text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_yo             uuid := (select auth.uid());
  v_usuario        uuid;
  v_suspendido_por uuid;
begin
  if not public.soy_moderador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  select a.usuario_id, p.suspendido_por into v_usuario, v_suspendido_por
  from public.apelaciones a
  join public.perfiles p on p.id = a.usuario_id
  where a.id = p_apelacion_id and a.estado = 'pendiente';

  if v_usuario is null then
    raise exception 'apelacion no encontrada o ya resuelta' using errcode = '22023';
  end if;

  if v_suspendido_por is not null and v_suspendido_por = v_yo then
    raise exception 'no puedes revisar una sancion que impusiste tu' using errcode = '42501';
  end if;

  update public.apelaciones
  set estado = (case when p_aceptar then 'aceptada' else 'rechazada' end)
               ::public.estado_apelacion,
      resuelta_por    = v_yo,
      resuelta_en     = now(),
      nota_moderacion = nullif(btrim(coalesce(p_nota, '')), '')
  where id = p_apelacion_id;

  if p_aceptar then
    update public.perfiles
    set suspendido_hasta = null, suspension_motivo = null, suspendido_por = null
    where id = v_usuario;
  end if;
end;
$$;

-- =============================================================================
-- AVISOS PUSH
-- =============================================================================

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

  -- El UPDATE del conflicto cambia también el dueño: el token es del aparato.
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

-- Mensaje nuevo. Respeta el bloqueo y no apila: si ya hay un aviso sin cerrar de
-- esa conversación, veinte mensajes seguidos siguen siendo un solo push.
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

-- Match nuevo: aviso a las dos partes. Ninguna de las dos sabe que el like era
-- recíproco hasta este momento.
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
    (new.usuario_1_id, 'match', 'Match',
     coalesce(v_n2, 'Alguien') || ' también te ha dado like.',
     jsonb_build_object('match_id', new.id, 'otro_id', new.usuario_2_id,
                        'nombre', coalesce(v_n2, 'Alguien'))),
    (new.usuario_2_id, 'match', 'Match',
     coalesce(v_n1, 'Alguien') || ' también te ha dado like.',
     jsonb_build_object('match_id', new.id, 'otro_id', new.usuario_1_id,
                        'nombre', coalesce(v_n1, 'Alguien')));
  return new;
end;
$$;

create trigger matches_notificar
  after insert on public.matches
  for each row execute function public.tg_notificar_match();

-- Enterarse de la sanción al intentar entrar es peor que enterarse en el
-- momento, y además retrasa la apelación.
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
            'Abre CannaMet para ver el motivo y apelar si no estás de acuerdo.',
            jsonb_build_object('hasta', new.suspendido_hasta));

  elsif old.suspendido_hasta is not null and new.suspendido_hasta is null then
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, datos)
    values (new.id, 'suspension', 'Cuenta restablecida',
            'Ya puedes volver a usar CannaMet.', '{}'::jsonb);
  end if;

  return new;
end;
$$;

create trigger perfiles_notificar_suspension
  after update of suspendido_hasta on public.perfiles
  for each row execute function public.tg_notificar_suspension();

-- La apelación aceptada ya avisa por la vía de la suspensión levantada. Esto
-- existe sobre todo para la rechazada, que si no no se comunica nunca.
create or replace function public.tg_notificar_apelacion()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.estado = 'rechazada' and old.estado = 'pendiente' then
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, datos)
    values (new.usuario_id, 'apelacion', 'Apelación revisada',
            'Hemos revisado tu apelación. Abre CannaMet para ver la respuesta.',
            '{}'::jsonb);
  end if;
  return new;
end;
$$;

create trigger apelaciones_notificar
  after update of estado on public.apelaciones
  for each row execute function public.tg_notificar_apelacion();

-- Reclamar y marcar son dos pasos separados a propósito: entre el envío a Expo
-- y la confirmación hay una llamada de red que puede fallar, y un aviso perdido
-- es preferible a uno repetido cada minuto.
create or replace function public.notificaciones_reclamar(p_limite int default 100)
returns table (
  id uuid, usuario_id uuid, tipo public.tipo_notificacion,
  titulo text, cuerpo text, datos jsonb, tokens text[]
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- Sin ningún aparato dado de alta no hay nada que enviar nunca: esas filas
  -- salen de la cola aquí en vez de gastar cinco intentos cada una.
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
      -- Espera cuadratica: 1, 4, 9 y 16 minutos. Los mismos cinco intentos
      -- cubren media hora larga en vez de cinco minutos.
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

-- Expo responde 'DeviceNotRegistered' cuando la app se desinstaló. Conservar ese
-- token es acumular basura y gastar una petición por aviso para siempre.
create or replace function public.dispositivos_baja(p_tokens text[])
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  delete from public.dispositivos where token = any(p_tokens);
$$;

-- El cron no envía: despierta a la Edge Function, que es quien habla con Expo.
-- La URL y la clave viven en Vault, no en el cuerpo de la función.
create or replace function public.notificaciones_despachar()
returns void
language plpgsql security definer
set search_path = public, extensions, net, vault, pg_temp
as $$
declare
  v_url   text;
  v_clave text;
begin
  -- Misma condicion que el reclamo: si todo lo pendiente esta esperando, no
  -- tiene sentido despertar a la Edge Function para que no haga nada.
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

-- =============================================================================
-- FOTOS DE PERFIL
-- =============================================================================
-- Bucket PRIVADO. Uno publico serviria cualquier foto a cualquiera con la URL,
-- para siempre y sin sesion; en una app 18+ con geolocalizacion eso es
-- exactamente lo que no se puede hacer. El cliente pide una URL firmada de una
-- hora cada vez que necesita pintarla.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- La ruta es <uid>/<fichero> y la politica compara el primer tramo con
-- auth.uid(): nadie escribe en la carpeta de otro aunque adivine el nombre.
create policy fotos_subir_propia on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy fotos_reemplazar_propia on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy fotos_borrar_propia on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Leer: cualquiera con sesion salvo bloqueo. Si no, bloquear a alguien le
-- seguiria dejando ver tu cara mientras tu ya no ves la suya.
create policy fotos_leer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and not public.hay_bloqueo(((storage.foldername(name))[1])::uuid)
  );

-- Subir y apuntar van separados porque en el alta el perfil todavia no existe:
-- la politica de Storage solo mira la carpeta, asi que la foto puede viajar
-- antes que la fila.
create or replace function public.fijar_mi_foto(p_ruta text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_yo uuid := (select auth.uid());
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  -- Sin esto, cualquiera podria apuntar su perfil a la foto de otra persona.
  if p_ruta is not null and split_part(p_ruta, '/', 1) <> v_yo::text then
    raise exception 'esa foto no es tuya' using errcode = '42501';
  end if;

  update public.perfiles set foto = p_ruta where id = v_yo;
end;
$$;

-- Solo suelta la referencia: el fichero se conserva porque borrarlo dejaria la
-- denuncia sin la prueba que la motivo.
create or replace function public.moderacion_borrar_foto(
  p_usuario_id uuid,
  p_nota       text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.soy_moderador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  update public.perfiles set foto = null where id = p_usuario_id;
end;
$$;

-- =============================================================================
-- DERECHOS DE LA PERSONA USUARIA (RGPD)
-- =============================================================================

create or replace function public.versiones_legales()
returns table (version_terminos text, version_privacidad text)
language sql stable security definer
set search_path = public, pg_temp
as $$ select (public.cfg()).version_terminos, (public.cfg()).version_privacidad; $$;

create or replace function public.consentimiento_al_dia()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.aceptaciones_legales a
    where a.usuario_id = (select auth.uid())
      and a.version_terminos = (public.cfg()).version_terminos
      and a.version_privacidad = (public.cfg()).version_privacidad
  );
$$;

create or replace function public.registrar_aceptacion()
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_yo  uuid := (select auth.uid());
  v_cfg public.config_moderacion := public.cfg();
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  insert into public.aceptaciones_legales
    (usuario_id, version_terminos, version_privacidad)
  values (v_yo, v_cfg.version_terminos, v_cfg.version_privacidad);
end;
$$;

-- Art. 17: supresión. Cascadea perfil, swipes, matches, mensajes, bloqueos y
-- apelaciones. Los reportes SOBRE esta persona permanecen anonimizados:
-- borrarse no puede ser una vía de escape de la moderación.
create or replace function public.borrar_mi_cuenta()
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_yo uuid := (select auth.uid());
begin
  if v_yo is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  delete from auth.users where id = v_yo;
end;
$$;

-- Art. 15: acceso. Devuelve si hay ubicación, nunca el punto: no tiene sentido
-- blindar las coordenadas en la base y luego volcarlas a un fichero exportado.
create or replace function public.exportar_mis_datos()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'generado_en', now(),
    'perfil', (
      select to_jsonb(x) from (
        select p.id, p.nombre, p.edad, p.bio, p.ambiente, p.foto,
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
    -- El token del aparato no se exporta: identifica al móvil, no informa de nada.
    'dispositivos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'plataforma', plataforma, 'alta', creado_en, 'visto', visto_en)), '[]'::jsonb)
      from public.dispositivos where usuario_id = (select auth.uid())
    ),
    'notificaciones_recibidas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', tipo, 'titulo', titulo, 'fecha', creado_en)
        order by creado_en), '[]'::jsonb)
      from public.notificaciones where usuario_id = (select auth.uid())
    )
  );
$$;

-- Art. 5.1.e: limitación del plazo de conservación.
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

  -- Un aviso caducado no le sirve ya a nadie. 30 días es margen de sobra para
  -- diagnosticar un fallo de entrega; más sería acumular por acumular.
  delete from public.notificaciones
  where creado_en < now() - interval '30 days';

  return v_borrados;
end;
$$;

-- =============================================================================
-- PERMISOS
-- =============================================================================
-- Supabase concede ALL por defecto a anon y authenticated en cada tabla nueva,
-- y EXECUTE a PUBLIC en cada función nueva. Todo lo que sigue es recorte.

-- anon no toca nada: la app exige sesión.
revoke all on public.perfiles, public.swipes, public.matches, public.mensajes,
              public.bloqueos, public.reportes, public.apelaciones,
              public.aceptaciones_legales, public.moderadores,
              public.config_moderacion, public.dispositivos,
              public.notificaciones
  from anon;

revoke all on public.moderadores, public.config_moderacion from public, authenticated;

-- Ni lectura en aparatos ni en la cola: el cliente solo tiene dos RPC. La RLS
-- sin políticas ya lo impide; el GRANT lo impide antes.
revoke all on public.dispositivos, public.notificaciones from authenticated;

-- `coordenadas` y `suspendido_por` fuera del SELECT a nivel de columna: la RLS
-- es por fila, así que sin esto un match leería el punto exacto de la otra
-- persona y cualquiera sabría qué moderador le sancionó.
revoke select on public.perfiles from authenticated;
grant select (
  id, nombre, edad, bio, ambiente, foto, creado_en, actualizado_en,
  suspendido_hasta, suspension_motivo, fecha_nacimiento
) on public.perfiles to authenticated;

-- swipes, matches, bloqueos, reportes y apelaciones solo se escriben vía RPC.
revoke insert, update, delete on public.swipes, public.matches, public.bloqueos,
                                 public.reportes, public.apelaciones,
                                 public.aceptaciones_legales
  from authenticated;

-- En mensajes, el receptor solo puede tocar `leido`, nunca reescribir `contenido`.
revoke update, delete on public.mensajes from authenticated;
grant update (leido) on public.mensajes to authenticated;

-- Funciones internas: nadie las invoca desde el cliente. Las de trigger se
-- ejecutan igual porque corren como su propietario, no como quien dispara.
revoke execute on function
  public.cfg(),
  public.edad_de(date),
  public.recalcular_edades(),
  public.purgar_reportes_antiguos(),
  public.tg_senal_bloqueos_repetidos(),
  public.tg_set_actualizado_en(),
  public.tg_notificar_mensaje(),
  public.tg_notificar_match(),
  public.tg_notificar_suspension(),
  public.tg_notificar_apelacion(),
  public.notificaciones_despachar(),
  public.notificaciones_reclamar(int),
  public.notificaciones_marcar(uuid[], text),
  public.dispositivos_baja(text[])
  from public, anon, authenticated;

-- Solo la Edge Function, que entra con service_role, drena la cola.
grant execute on function
  public.notificaciones_reclamar(int),
  public.notificaciones_marcar(uuid[], text),
  public.dispositivos_baja(text[])
  to service_role;

-- RPC de aplicación: solo con sesión.
revoke execute on function
  public.descubrir_perfiles(int, int),
  public.registrar_swipe(uuid, public.accion_swipe),
  public.listar_matches(),
  public.guardar_perfil(text, date, text, public.ambiente_preferido, double precision, double precision),
  public.es_miembro_de_match(uuid),
  public.puede_escribir_en_match(uuid),
  public.hay_bloqueo(uuid),
  public.estoy_suspendido(),
  public.cuota_swipes_restante(),
  public.bloquear_usuario(uuid),
  public.desbloquear_usuario(uuid),
  public.listar_bloqueados(),
  public.reportar_usuario(uuid, public.motivo_reporte, text, boolean),
  public.soy_moderador(),
  public.moderacion_cola(int),
  public.moderacion_resolver(uuid, public.estado_reporte, int, text),
  public.moderacion_levantar_suspension(uuid),
  public.apelar(text),
  public.moderacion_apelaciones(int),
  public.moderacion_resolver_apelacion(uuid, boolean, text),
  public.versiones_legales(),
  public.consentimiento_al_dia(),
  public.registrar_aceptacion(),
  public.borrar_mi_cuenta(),
  public.exportar_mis_datos(),
  public.registrar_dispositivo(text, public.plataforma_dispositivo),
  public.olvidar_dispositivo(text),
  public.fijar_mi_foto(text),
  public.moderacion_borrar_foto(uuid, text)
  from public, anon;

grant execute on function
  public.descubrir_perfiles(int, int),
  public.registrar_swipe(uuid, public.accion_swipe),
  public.listar_matches(),
  public.guardar_perfil(text, date, text, public.ambiente_preferido, double precision, double precision),
  public.es_miembro_de_match(uuid),
  public.puede_escribir_en_match(uuid),
  public.hay_bloqueo(uuid),
  public.estoy_suspendido(),
  public.cuota_swipes_restante(),
  public.bloquear_usuario(uuid),
  public.desbloquear_usuario(uuid),
  public.listar_bloqueados(),
  public.reportar_usuario(uuid, public.motivo_reporte, text, boolean),
  public.soy_moderador(),
  public.moderacion_cola(int),
  public.moderacion_resolver(uuid, public.estado_reporte, int, text),
  public.moderacion_levantar_suspension(uuid),
  public.apelar(text),
  public.moderacion_apelaciones(int),
  public.moderacion_resolver_apelacion(uuid, boolean, text),
  public.versiones_legales(),
  public.consentimiento_al_dia(),
  public.registrar_aceptacion(),
  public.borrar_mi_cuenta(),
  public.exportar_mis_datos(),
  public.registrar_dispositivo(text, public.plataforma_dispositivo),
  public.olvidar_dispositivo(text),
  public.fijar_mi_foto(text),
  public.moderacion_borrar_foto(uuid, text)
  to authenticated;

-- =============================================================================
-- REALTIME Y TAREAS PROGRAMADAS
-- =============================================================================

alter publication supabase_realtime add table public.mensajes;
alter publication supabase_realtime add table public.matches;

select cron.schedule('recalcular-edades', '30 3 * * *',
  $CRON$select public.recalcular_edades();$CRON$);

select cron.schedule('purga-reportes-antiguos', '0 4 * * *',
  $CRON$select public.purgar_reportes_antiguos();$CRON$);

-- Cada minuto: si no hay nada pendiente la función sale sin hacer red.
select cron.schedule('despachar-notificaciones', '* * * * *',
  $CRON$select public.notificaciones_despachar();$CRON$);

commit;

-- =============================================================================
-- PASOS MANUALES TRAS EL DESPLIEGUE
-- =============================================================================
-- 1. La cola de moderación no la lee nadie hasta que exista al menos un moderador:
--
--      insert into public.moderadores (usuario_id, nota)
--      values ('<uuid de auth.users>', 'quién y por qué');
--
-- 2. Los avisos push no salen hasta que Vault tenga los dos secretos y la Edge
--    Function esté desplegada:
--
--      select vault.create_secret(
--        'https://<ref>.supabase.co/functions/v1/notificar', 'url_funcion_notificar');
--      select vault.create_secret('<clave service_role>', 'clave_service_role');
--
--      supabase functions deploy notificar
-- =============================================================================
