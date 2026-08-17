-- Guardamos quien sanciono para que no pueda revisar su propia decision.
alter table public.perfiles
  add column suspendido_por uuid references auth.users(id) on delete set null;

create type public.estado_apelacion as enum ('pendiente','aceptada','rechazada');

create table public.apelaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 10 and 1000),
  estado public.estado_apelacion not null default 'pendiente',
  creado_en timestamptz not null default now(),
  resuelta_por uuid references auth.users(id) on delete set null,
  resuelta_en timestamptz,
  nota_moderacion text
);

-- Una apelacion pendiente por persona: apelar en bucle es otra forma de spam.
create unique index apelaciones_una_pendiente
  on public.apelaciones (usuario_id) where estado = 'pendiente';
create index apelaciones_cola_idx
  on public.apelaciones (creado_en asc) where estado = 'pendiente';

alter table public.apelaciones enable row level security;
revoke insert, update, delete on public.apelaciones from authenticated;
revoke all on public.apelaciones from anon;

create policy apelaciones_select_propias on public.apelaciones
  for select to authenticated using ((select auth.uid()) = usuario_id);
create policy apelaciones_select_moderador on public.apelaciones
  for select to authenticated using (public.soy_moderador());

create or replace function public.apelar(p_texto text)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_yo uuid := (select auth.uid()); v_hasta timestamptz; v_id uuid;
begin
  if v_yo is null then raise exception 'no autenticado' using errcode = '28000'; end if;
  select suspendido_hasta into v_hasta from public.perfiles where id = v_yo;
  if v_hasta is null or v_hasta <= now() then
    raise exception 'tu cuenta no esta suspendida' using errcode = '22023'; end if;
  if exists (select 1 from public.apelaciones where usuario_id = v_yo and estado = 'pendiente') then
    raise exception 'ya tienes una apelacion pendiente de revisar' using errcode = '22023'; end if;
  insert into public.apelaciones (usuario_id, texto) values (v_yo, btrim(p_texto))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.moderacion_apelaciones(p_limite int default 50)
returns table (
  id uuid, usuario_id uuid, nombre text, texto text, creado_en timestamptz,
  suspendido_hasta timestamptz, suspension_motivo text, puedo_resolver boolean
)
language sql stable security definer
set search_path = public, pg_temp as $$
  select a.id, a.usuario_id, p.nombre, a.texto, a.creado_en,
         p.suspendido_hasta, p.suspension_motivo,
         -- Si el moderador actual fue quien sanciono, no puede resolverla.
         (p.suspendido_por is null or p.suspendido_por <> (select auth.uid()))
  from public.apelaciones a
  join public.perfiles p on p.id = a.usuario_id
  where public.soy_moderador() and a.estado = 'pendiente'
  order by a.creado_en asc
  limit least(greatest(p_limite, 1), 200);
$$;

create or replace function public.moderacion_resolver_apelacion(
  p_apelacion_id uuid, p_aceptar boolean, p_nota text default null
)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_yo uuid := (select auth.uid()); v_usuario uuid; v_sancionador uuid;
begin
  if not public.soy_moderador() then
    raise exception 'no autorizado' using errcode = '42501'; end if;

  select a.usuario_id, p.suspendido_por into v_usuario, v_sancionador
  from public.apelaciones a join public.perfiles p on p.id = a.usuario_id
  where a.id = p_apelacion_id and a.estado = 'pendiente';

  if v_usuario is null then
    raise exception 'apelacion no encontrada o ya resuelta' using errcode = '22023'; end if;

  -- Revisar tu propia sancion no es una apelacion, es una ratificacion.
  if v_sancionador is not null and v_sancionador = v_yo then
    raise exception 'no puedes revisar una sancion que impusiste tu'
      using errcode = '42501'; end if;

  update public.apelaciones
  set estado = (case when p_aceptar then 'aceptada' else 'rechazada' end)::public.estado_apelacion,
      resuelta_por = v_yo, resuelta_en = now(),
      nota_moderacion = nullif(btrim(coalesce(p_nota,'')), '')
  where id = p_apelacion_id;

  if p_aceptar then
    update public.perfiles
    set suspendido_hasta = null, suspension_motivo = null, suspendido_por = null
    where id = v_usuario;
  end if;
end; $$;

-- moderacion_resolver pasa a guardar suspendido_por = auth.uid()

revoke execute on function public.apelar(text) from public, anon;
revoke execute on function public.moderacion_apelaciones(int) from public, anon;
revoke execute on function public.moderacion_resolver_apelacion(uuid, boolean, text) from public, anon;
grant execute on function public.apelar(text) to authenticated;
grant execute on function public.moderacion_apelaciones(int) to authenticated;
grant execute on function public.moderacion_resolver_apelacion(uuid, boolean, text) to authenticated;
