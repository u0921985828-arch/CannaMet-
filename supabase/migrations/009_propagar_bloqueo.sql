-- El bloqueo tiene que alcanzar TODAS las superficies donde aparece una persona:
-- feed, lista de chats, lectura de perfil y envio de mensajes.

drop policy if exists perfiles_select_match on public.perfiles;
create policy perfiles_select_match on public.perfiles
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where (m.usuario_1_id = perfiles.id and m.usuario_2_id = (select auth.uid()))
         or (m.usuario_2_id = perfiles.id and m.usuario_1_id = (select auth.uid()))
    )
    and not public.hay_bloqueo(perfiles.id)
  );

-- es_miembro_de_match gobierna las 3 politicas de mensajes: el bloqueo se
-- propaga a lectura, escritura y marcado de leidos de una sola vez.
create or replace function public.es_miembro_de_match(p_match_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
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
revoke execute on function public.es_miembro_de_match(uuid) from public, anon;
grant execute on function public.es_miembro_de_match(uuid) to authenticated;

-- Las dos RPC de listado se reescriben aqui (no en 005/006) porque
-- public.bloqueos no existe hasta 008 y el cuerpo se valida al crearse.

create or replace function public.descubrir_perfiles(
  p_radio_km int default 50,
  p_limite int default 20
)
returns table (
  id uuid, nombre text, edad int, bio text,
  preferencia_consumo public.preferencia_consumo, distancia_km numeric
)
language sql stable security definer
set search_path = public, extensions, pg_temp as $$
  select p.id, p.nombre, p.edad, p.bio, p.preferencia_consumo,
         round((extensions.st_distance(p.coordenadas, yo.coordenadas) / 1000)::numeric, 1)
  from public.perfiles p
  cross join lateral (
    select coordenadas from public.perfiles
    where id = (select auth.uid()) and coordenadas is not null
  ) yo
  where p.id <> (select auth.uid())
    and p.coordenadas is not null
    and extensions.st_dwithin(p.coordenadas, yo.coordenadas, greatest(p_radio_km, 1) * 1000)
    and not exists (
      select 1 from public.swipes s
      where s.usuario_origen_id = (select auth.uid()) and s.usuario_destino_id = p.id
    )
    and not exists (
      select 1 from public.bloqueos b
      where (b.bloqueador_id = (select auth.uid()) and b.bloqueado_id = p.id)
         or (b.bloqueador_id = p.id and b.bloqueado_id = (select auth.uid()))
    )
  order by p.coordenadas <-> yo.coordenadas
  limit least(greatest(p_limite, 1), 50);
$$;
revoke execute on function public.descubrir_perfiles(int, int) from public, anon;
grant execute on function public.descubrir_perfiles(int, int) to authenticated;

create or replace function public.listar_matches()
returns table (
  match_id uuid, otro_id uuid, otro_nombre text, otro_edad int,
  otro_preferencia public.preferencia_consumo,
  ultimo_mensaje text, ultimo_mensaje_en timestamptz,
  no_leidos bigint, creado_en timestamptz
)
language sql stable security definer
set search_path = public, pg_temp as $$
  select m.id, o.id, o.nombre, o.edad, o.preferencia_consumo,
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
    and not exists (
      select 1 from public.bloqueos b
      where (b.bloqueador_id = m.usuario_1_id and b.bloqueado_id = m.usuario_2_id)
         or (b.bloqueador_id = m.usuario_2_id and b.bloqueado_id = m.usuario_1_id)
    )
  order by coalesce(um.creado_en, m.creado_en) desc;
$$;
revoke execute on function public.listar_matches() from public, anon;
grant execute on function public.listar_matches() to authenticated;
