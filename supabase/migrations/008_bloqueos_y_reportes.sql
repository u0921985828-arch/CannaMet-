-- ============ MOTIVOS ============
create type public.motivo_reporte as enum (
  'menor_de_edad','acoso_o_amenazas','contenido_sexual',
  'perfil_falso','spam_o_estafa','otro'
);
create type public.estado_reporte as enum ('pendiente','revisado','actuado','descartado');

-- ============ BLOQUEOS ============
create table public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  bloqueador_id uuid not null references public.perfiles(id) on delete cascade,
  bloqueado_id uuid not null references public.perfiles(id) on delete cascade,
  creado_en timestamptz not null default now(),
  constraint bloqueos_no_autobloqueo check (bloqueador_id <> bloqueado_id),
  constraint bloqueos_unicos unique (bloqueador_id, bloqueado_id)
);
create index bloqueos_bloqueado_idx on public.bloqueos (bloqueado_id, bloqueador_id);
alter table public.bloqueos enable row level security;

-- ============ REPORTES ============
-- reportado_id es NULLABLE a proposito: el reporte debe sobrevivir al borrado
-- de la cuenta denunciada, o cualquiera se libra de la cola borrandose.
create table public.reportes (
  id uuid primary key default gen_random_uuid(),
  reportante_id uuid not null references public.perfiles(id) on delete cascade,
  reportado_id uuid references public.perfiles(id) on delete set null,
  reportado_nombre text,
  motivo public.motivo_reporte not null,
  detalle text check (char_length(detalle) <= 1000),
  estado public.estado_reporte not null default 'pendiente',
  creado_en timestamptz not null default now(),
  constraint reportes_no_autoreporte check (reportante_id <> reportado_id)
);
create index reportes_pendientes_idx on public.reportes (creado_en desc) where estado = 'pendiente';
create index reportes_reportado_idx on public.reportes (reportado_id);
alter table public.reportes enable row level security;

-- ============ RLS ============
create or replace function public.hay_bloqueo(p_otro_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.bloqueos b
    where (b.bloqueador_id = (select auth.uid()) and b.bloqueado_id = p_otro_id)
       or (b.bloqueador_id = p_otro_id and b.bloqueado_id = (select auth.uid()))
  );
$$;
revoke execute on function public.hay_bloqueo(uuid) from public, anon;
grant execute on function public.hay_bloqueo(uuid) to authenticated;

create policy bloqueos_select_propios on public.bloqueos
  for select to authenticated using ((select auth.uid()) = bloqueador_id);

create policy reportes_select_propios on public.reportes
  for select to authenticated using ((select auth.uid()) = reportante_id);

revoke insert, update, delete on public.bloqueos from authenticated;
revoke insert, update, delete on public.reportes from authenticated;
revoke all on public.bloqueos from anon;
revoke all on public.reportes from anon;
