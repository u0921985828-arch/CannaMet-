-- Los umbrales dejan de estar enterrados en el cuerpo de las funciones.
-- Sin datos reales son una conjetura: hay que poder ajustarlos sin migrar.
create table public.config_moderacion (
  id boolean primary key default true check (id),
  bloqueos_para_senal int not null default 3 check (bloqueos_para_senal between 2 and 50),
  ventana_senal_dias int not null default 30 check (ventana_senal_dias between 1 and 365),
  horas_cuenta_nueva int not null default 24 check (horas_cuenta_nueva between 0 and 720),
  cuota_swipes_cuenta_nueva int not null default 30 check (cuota_swipes_cuenta_nueva between 1 and 1000),
  max_reportes_por_hora int not null default 10 check (max_reportes_por_hora between 1 and 100),
  dias_retencion_reportes int not null default 180 check (dias_retencion_reportes between 30 and 3650),
  actualizado_en timestamptz not null default now()
);
insert into public.config_moderacion default values;
alter table public.config_moderacion enable row level security;
revoke all on public.config_moderacion from anon, authenticated;

comment on table public.config_moderacion is
  'Fila unica. Editable desde el dashboard con service_role, sin migracion.';

create or replace function public.cfg()
returns public.config_moderacion
language sql stable security definer
set search_path = public, pg_temp as $$
  select * from public.config_moderacion where id;
$$;
revoke execute on function public.cfg() from public, anon, authenticated;

-- tg_senal_bloqueos_repetidos, cuota_swipes_restante, puede_escribir_en_match,
-- registrar_swipe y reportar_usuario se reescriben para leer de cfg().
-- Cuerpos identicos a los previos sustituyendo las constantes por v_cfg.*
