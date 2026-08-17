set search_path = public, extensions;

create type public.preferencia_consumo as enum (
  'fumado','vaporizado','comestible','concentrados','mixto','prefiero_no_decir'
);
create type public.accion_swipe as enum ('like','dislike');

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 40),
  edad int not null check (edad >= 18 and edad <= 120),
  bio text check (char_length(bio) <= 500),
  preferencia_consumo public.preferencia_consumo not null default 'prefiero_no_decir',
  coordenadas extensions.geography(Point, 4326),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index perfiles_coordenadas_idx on public.perfiles using gist (coordenadas);

create or replace function public.tg_set_actualizado_en()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.actualizado_en := now(); return new; end; $$;

create trigger perfiles_set_actualizado_en
  before update on public.perfiles
  for each row execute function public.tg_set_actualizado_en();

alter table public.perfiles enable row level security;

create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  usuario_origen_id uuid not null references public.perfiles(id) on delete cascade,
  usuario_destino_id uuid not null references public.perfiles(id) on delete cascade,
  accion public.accion_swipe not null,
  creado_en timestamptz not null default now(),
  constraint swipes_no_autoswipe check (usuario_origen_id <> usuario_destino_id),
  constraint swipes_unicos unique (usuario_origen_id, usuario_destino_id)
);
create index swipes_destino_accion_idx on public.swipes (usuario_destino_id, accion);
alter table public.swipes enable row level security;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  usuario_1_id uuid not null references public.perfiles(id) on delete cascade,
  usuario_2_id uuid not null references public.perfiles(id) on delete cascade,
  creado_en timestamptz not null default now(),
  constraint matches_orden_canonico check (usuario_1_id < usuario_2_id),
  constraint matches_unicos unique (usuario_1_id, usuario_2_id)
);
create index matches_usuario_2_idx on public.matches (usuario_2_id);
alter table public.matches enable row level security;

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  remitente_id uuid not null references public.perfiles(id) on delete cascade,
  contenido text not null check (char_length(btrim(contenido)) between 1 and 2000),
  leido boolean not null default false,
  -- clock_timestamp(), no now(): now() es el instante de la TRANSACCION y dos
  -- mensajes insertados juntos compartirian timestamp, dejando el orden indefinido.
  creado_en timestamptz not null default clock_timestamp()
);
create index mensajes_orden_idx on public.mensajes (match_id, creado_en desc, id desc);
create index mensajes_no_leidos_idx on public.mensajes (match_id, remitente_id) where leido = false;
alter table public.mensajes enable row level security;
