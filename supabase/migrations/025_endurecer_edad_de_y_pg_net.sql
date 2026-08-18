-- Dos avisos del linter de Supabase tras aplicar 024, los dos reales.

-- 1. `create extension pg_net` sin `with schema` deja la extension registrada en
--    `public`. Sus funciones viven en el esquema `net` en cualquier caso —pg_net
--    lo crea el mismo—, asi que nada dejaba de funcionar, pero la extension
--    queda donde no debe. No admite SET SCHEMA: hay que reinstalarla.
drop extension if exists pg_net;
create extension pg_net with schema extensions;

-- 2. `edad_de` estaba marcada IMMUTABLE y lee `current_date`. Eso es mentirle al
--    planificador: Postgres puede plegar una immutable a constante en un plan
--    cacheado o en un indice, y ahi la edad se quedaria congelada en el valor
--    del dia en que se planifico. Justo lo que el cron de las 03:30 existe para
--    evitar. STABLE es la volatilidad correcta.
--
--    De paso fija el search_path: sin el, quien pueda crear objetos en un
--    esquema anterior de la ruta puede secuestrar `age()` o `extract()`.
create or replace function public.edad_de(p_fecha date)
returns int
language sql stable
set search_path = pg_catalog, pg_temp
as $$ select extract(year from age(current_date, p_fecha))::int; $$;

revoke execute on function public.edad_de(date) from public, anon, authenticated;
