-- Fotos de perfil. El modelo era tipografico por diseño y eso funcionaba como
-- decision estetica, pero en una app de conocer gente la ausencia de foto no es
-- minimalismo: es una funcion que falta.
--
-- Tres decisiones:
--
-- 1. BUCKET PRIVADO. Uno publico serviria cualquier foto a cualquiera con la
--    URL, para siempre y sin sesion. En una app 18+ con geolocalizacion eso es
--    exactamente lo que no se puede hacer.
--
-- 2. LA RUTA ES <uid>/<fichero>. La politica de escritura compara el primer
--    tramo con auth.uid(), asi que nadie puede escribir en la carpeta de otro
--    aunque adivine el nombre.
--
-- 3. EL BLOQUEO TAMBIEN TAPA LA FOTO. Si no, bloquear a alguien le seguiria
--    dejando ver tu cara mientras tu ya no ves la suya.

begin;

alter table public.perfiles
  add column if not exists foto text
    check (foto is null or foto ~ '^[0-9a-f-]{36}/[a-zA-Z0-9._-]{1,80}$');

comment on column public.perfiles.foto is
  'Ruta dentro del bucket `fotos`, con la forma <uid>/<fichero>. Nunca una URL: '
  'las URL firmadas caducan y guardar una seria guardar basura.';

-- El GRANT por columna se rehace: `foto` tiene que salir al cliente.
revoke select on public.perfiles from authenticated;
grant select (
  id, nombre, edad, bio, ambiente, foto, creado_en, actualizado_en,
  suspendido_hasta, suspension_motivo, fecha_nacimiento
) on public.perfiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Cada cual manda solo en su carpeta.
drop policy if exists fotos_subir_propia on storage.objects;
create policy fotos_subir_propia on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists fotos_reemplazar_propia on storage.objects;
create policy fotos_reemplazar_propia on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists fotos_borrar_propia on storage.objects;
create policy fotos_borrar_propia on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Leer: cualquiera con sesion salvo que haya bloqueo de por medio. Es lo mismo
-- que ya expone el descubrimiento, que devuelve nombre, edad y distancia de
-- desconocidos: la foto de perfil se enseña a desconocidos a proposito.
drop policy if exists fotos_leer on storage.objects;
create policy fotos_leer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and not public.hay_bloqueo(((storage.foldername(name))[1])::uuid)
  );

-- ─────────────────────────────── RPC ───────────────────────────────

-- Se separa de guardar_perfil porque el orden importa: primero sube el fichero,
-- y solo si eso funciona se apunta la ruta. Al reves quedaria un perfil
-- apuntando a una foto que no existe.
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

create or replace function public.moderacion_borrar_foto(p_usuario_id uuid, p_nota text default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.soy_moderador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  -- Solo se suelta la referencia: el fichero lo barre la limpieza del bucket.
  -- Borrarlo aqui dejaria la denuncia sin la prueba que la motivo.
  update public.perfiles set foto = null where id = p_usuario_id;
end;
$$;

-- ──────────────────── RPC QUE AHORA DEVUELVEN LA FOTO ────────────────────

drop function if exists public.descubrir_perfiles(int, int);
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

drop function if exists public.listar_matches();
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

-- La cola de moderacion enseña si hay foto: decidir sobre una denuncia de
-- contenido sexual sin poder mirarla es decidir a ciegas.
drop function if exists public.moderacion_cola(int);
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

-- El export del art. 15 tambien: la foto es un dato personal como el resto.
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

-- ──────────────────────────── PERMISOS ────────────────────────────

revoke execute on function
  public.fijar_mi_foto(text),
  public.moderacion_borrar_foto(uuid, text),
  public.descubrir_perfiles(int, int),
  public.listar_matches(),
  public.moderacion_cola(int),
  public.exportar_mis_datos()
  from public, anon, authenticated;

grant execute on function
  public.fijar_mi_foto(text),
  public.moderacion_borrar_foto(uuid, text),
  public.descubrir_perfiles(int, int),
  public.listar_matches(),
  public.moderacion_cola(int),
  public.exportar_mis_datos()
  to authenticated;

commit;
