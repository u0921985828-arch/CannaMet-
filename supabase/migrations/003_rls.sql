create or replace function public.es_miembro_de_match(p_match_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (select auth.uid()) in (m.usuario_1_id, m.usuario_2_id)
  );
$$;
revoke execute on function public.es_miembro_de_match(uuid) from public, anon;
grant execute on function public.es_miembro_de_match(uuid) to authenticated;

create policy perfiles_select_propio on public.perfiles
  for select to authenticated using ((select auth.uid()) = id);

create policy perfiles_select_match on public.perfiles
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where (m.usuario_1_id = perfiles.id and m.usuario_2_id = (select auth.uid()))
         or (m.usuario_2_id = perfiles.id and m.usuario_1_id = (select auth.uid()))
    )
  );

create policy perfiles_insert_propio on public.perfiles
  for insert to authenticated with check ((select auth.uid()) = id);

create policy perfiles_update_propio on public.perfiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy perfiles_delete_propio on public.perfiles
  for delete to authenticated using ((select auth.uid()) = id);

create policy swipes_select_propios on public.swipes
  for select to authenticated using ((select auth.uid()) = usuario_origen_id);

create policy matches_select_propios on public.matches
  for select to authenticated using ((select auth.uid()) in (usuario_1_id, usuario_2_id));

create policy mensajes_select_del_match on public.mensajes
  for select to authenticated using (public.es_miembro_de_match(match_id));

create policy mensajes_insert_propio on public.mensajes
  for insert to authenticated with check (
    (select auth.uid()) = remitente_id and public.es_miembro_de_match(match_id)
  );

create policy mensajes_update_leido on public.mensajes
  for update to authenticated
  using (public.es_miembro_de_match(match_id) and remitente_id <> (select auth.uid()))
  with check (public.es_miembro_de_match(match_id) and remitente_id <> (select auth.uid()));
