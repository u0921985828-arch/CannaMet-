revoke all on public.perfiles, public.swipes, public.matches, public.mensajes from anon;
revoke insert, update, delete on public.swipes from authenticated;
revoke insert, update, delete on public.matches from authenticated;
revoke update on public.mensajes from authenticated;
grant update (leido) on public.mensajes to authenticated;
revoke delete on public.mensajes from authenticated;

-- `coordenadas` no sale nunca al cliente. La RLS es por fila, asi que sin este
-- grant columnar un match podria leer el punto exacto de la otra persona.
revoke select on public.perfiles from authenticated;
grant select (
  id, nombre, edad, bio, preferencia_consumo, creado_en, actualizado_en
) on public.perfiles to authenticated;
