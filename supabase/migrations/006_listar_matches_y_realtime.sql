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
  order by coalesce(um.creado_en, m.creado_en) desc;
$$;
revoke execute on function public.listar_matches() from public, anon;
grant execute on function public.listar_matches() to authenticated;

alter publication supabase_realtime add table public.mensajes;
alter publication supabase_realtime add table public.matches;
alter table public.mensajes replica identity full;
