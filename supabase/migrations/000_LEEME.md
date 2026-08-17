# Migraciones

Este directorio es **historial**, no fuente de verdad.

Para levantar un entorno nuevo usa `supabase/schema.sql`, que está extraído del
catálogo de la base en producción y se aplica de una sola pasada:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
```

Los ficheros numerados documentan el orden en que se tomaron las decisiones y
por qué. Varios corrigen a los anteriores, así que leerlos en secuencia enseña
más que el esquema final — pero replicarlos uno a uno no está garantizado.
