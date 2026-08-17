-- ── EDAD REAL, NO UN NUMERO ESCRITO A MANO ──
-- `edad` como int es un campo que el usuario teclea y que envejece mal: quien
-- puso 18 hace dos anos sigue figurando con 18.
alter table public.perfiles add column fecha_nacimiento date;

create or replace function public.edad_de(p_fecha date)
returns int language sql immutable as $$
  select extract(year from age(current_date, p_fecha))::int;
$$;

alter table public.perfiles add constraint perfiles_mayor_de_edad
  check (fecha_nacimiento is null
    or (fecha_nacimiento <= current_date - interval '18 years'
        and fecha_nacimiento >= current_date - interval '120 years'));

-- ── CONSENTIMIENTO, CON PRUEBA ──
-- El RGPD exige poder DEMOSTRAR el consentimiento (art. 7.1), no solo obtenerlo.
-- Sin IP: seria un dato personal extra que no necesitamos.
create table public.aceptaciones_legales (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  version_terminos text not null,
  version_privacidad text not null,
  acepta_datos_salud boolean not null default false,
  aceptado_en timestamptz not null default now()
);
create index aceptaciones_usuario_idx
  on public.aceptaciones_legales (usuario_id, aceptado_en desc);

alter table public.aceptaciones_legales enable row level security;
revoke insert, update, delete on public.aceptaciones_legales from authenticated;
revoke all on public.aceptaciones_legales from anon;

create policy aceptaciones_select_propias on public.aceptaciones_legales
  for select to authenticated using ((select auth.uid()) = usuario_id);

comment on table public.aceptaciones_legales is
  'Historico, no se actualiza: cada version aceptada deja su propia fila.';

-- Versiones vigentes en config para forzar re-aceptacion sin migrar.
alter table public.config_moderacion
  add column version_terminos text not null default '2026-08-1',
  add column version_privacidad text not null default '2026-08-1';

create or replace function public.versiones_legales()
returns table (version_terminos text, version_privacidad text)
language sql stable security definer
set search_path = public, pg_temp as $$
  select (public.cfg()).version_terminos, (public.cfg()).version_privacidad;
$$;

-- Pasa a false solo cuando cambian los textos: la app vuelve a pedir aceptacion.
create or replace function public.consentimiento_al_dia()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.aceptaciones_legales a
    where a.usuario_id = (select auth.uid())
      and a.version_terminos = (public.cfg()).version_terminos
      and a.version_privacidad = (public.cfg()).version_privacidad);
$$;

create or replace function public.registrar_aceptacion(
  p_acepta_datos_salud boolean default false
)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_yo uuid := (select auth.uid()); v_cfg public.config_moderacion := public.cfg();
begin
  if v_yo is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  insert into public.aceptaciones_legales
    (usuario_id, version_terminos, version_privacidad, acepta_datos_salud)
  values (v_yo, v_cfg.version_terminos, v_cfg.version_privacidad, p_acepta_datos_salud);
end; $$;

revoke execute on function public.edad_de(date) from public, anon, authenticated;
revoke execute on function public.versiones_legales() from public, anon;
revoke execute on function public.consentimiento_al_dia() from public, anon;
revoke execute on function public.registrar_aceptacion(boolean) from public, anon;
grant execute on function public.versiones_legales() to authenticated;
grant execute on function public.consentimiento_al_dia() to authenticated;
grant execute on function public.registrar_aceptacion(boolean) to authenticated;
