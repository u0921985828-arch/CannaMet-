-- FALLO CORREGIDO: exportar_mis_datos() seguia leyendo p.preferencia_consumo,
-- columna eliminada en 022. Postgres no valida los cuerpos SQL en cadena al
-- dropear una columna, asi que la funcion quedo rota en TIEMPO DE EJECUCION:
-- el derecho de acceso (art. 15 RGPD) fallaba con "column does not exist".
-- Ver supabase/schema.sql para el cuerpo definitivo.

-- registrar_aceptacion pierde el parametro de datos de salud: el perfil ya no
-- los recoge. La columna acepta_datos_salud queda como historico inmutable.
drop function if exists public.registrar_aceptacion(boolean);
