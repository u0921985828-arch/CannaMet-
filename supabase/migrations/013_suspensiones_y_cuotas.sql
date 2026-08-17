alter table public.perfiles
  add column suspendido_hasta timestamptz,
  add column suspension_motivo text;

create index perfiles_suspendidos_idx on public.perfiles (suspendido_hasta)
  where suspendido_hasta is not null;

-- El usuario debe poder ver su propia suspension: una app que falla en silencio
-- empuja a reinstalar o a crear otra cuenta, que es lo contrario del objetivo.
grant select (suspendido_hasta, suspension_motivo) on public.perfiles to authenticated;

create or replace function public.estoy_suspendido()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(
    (select suspendido_hasta > now() from public.perfiles where id = (select auth.uid())),
    false);
$$;

-- Cuota de swipes en las primeras 24 h. No detiene a un acosador decidido,
-- pero encarece la cuenta desechable de spam, que es el volumen real.
create or replace function public.cuota_swipes_restante()
returns int language sql stable security definer
set search_path = public, pg_temp as $$
  select case
    when (select creado_en from public.perfiles where id = (select auth.uid()))
         > now() - interval '24 hours'
    then greatest(0, 30 - (
      select count(*)::int from public.swipes
      where usuario_origen_id = (select auth.uid())
        and creado_en > now() - interval '24 hours'))
    else 2147483647
  end;
$$;

-- Una cuenta recien creada no puede ABRIR conversacion: tiene que responder.
-- Frena la cuenta desechable que hace match y suelta un enlace de estafa.
create or replace function public.puede_escribir_en_match(p_match_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.es_miembro_de_match(p_match_id)
    and coalesce((select suspendido_hasta is null or suspendido_hasta <= now()
                  from public.perfiles where id = (select auth.uid())), false)
    and (
      coalesce((select creado_en <= now() - interval '24 hours'
                from public.perfiles where id = (select auth.uid())), false)
      or exists (select 1 from public.mensajes m
                 where m.match_id = p_match_id
                   and m.remitente_id <> (select auth.uid()))
    );
$$;

drop policy if exists mensajes_insert_propio on public.mensajes;
create policy mensajes_insert_propio on public.mensajes
  for insert to authenticated
  with check ((select auth.uid()) = remitente_id
              and public.puede_escribir_en_match(match_id));

revoke execute on function public.estoy_suspendido() from public, anon;
revoke execute on function public.cuota_swipes_restante() from public, anon;
revoke execute on function public.puede_escribir_en_match(uuid) from public, anon;
grant execute on function public.estoy_suspendido() to authenticated;
grant execute on function public.cuota_swipes_restante() to authenticated;
grant execute on function public.puede_escribir_en_match(uuid) to authenticated;

-- registrar_swipe y descubrir_perfiles se reescriben para respetar suspension
-- y cuota: ver 014.
