-- Dejar el dato "por si acaso" seria conservar informacion de salud que ya no
-- se usa: exactamente lo contrario de minimizar (art. 5.1.c RGPD).
alter table public.perfiles drop column preferencia_consumo;
drop type public.preferencia_consumo;

comment on column public.aceptaciones_legales.acepta_datos_salud is
  'OBSOLETO desde 2026-08-2. El perfil ya no recoge datos de salud. Se conserva '
  'como historico de consentimientos anteriores; no se rellena en altas nuevas.';

-- El GRANT columnar hay que rehacerlo: la columna vieja ya no existe.
revoke select on public.perfiles from authenticated;
grant select (
  id, nombre, edad, bio, ambiente, creado_en, actualizado_en,
  suspendido_hasta, suspension_motivo, fecha_nacimiento
) on public.perfiles to authenticated;

-- Nueva version de los textos legales: fuerza re-aceptacion en el proximo arranque.
update public.config_moderacion
set version_terminos = '2026-08-2',
    version_privacidad = '2026-08-2',
    actualizado_en = now();
