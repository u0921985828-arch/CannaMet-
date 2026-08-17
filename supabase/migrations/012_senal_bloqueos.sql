create type public.origen_reporte as enum ('usuario','automatico');

alter table public.reportes
  add column origen public.origen_reporte not null default 'usuario';
alter table public.reportes alter column reportante_id drop not null;

-- Tres personas distintas bloqueando a la misma en 30 dias es una senal,
-- no una coincidencia. Usa datos que ya existen: nadie denuncia nada extra.
create or replace function public.tg_senal_bloqueos_repetidos()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_distintos int; v_nombre text;
begin
  select count(distinct bloqueador_id) into v_distintos
  from public.bloqueos
  where bloqueado_id = new.bloqueado_id and creado_en > now() - interval '30 days';

  if v_distintos < 3 then return new; end if;

  -- No apilar senales mientras haya una sin revisar.
  if exists (
    select 1 from public.reportes
    where reportado_id = new.bloqueado_id
      and origen = 'automatico' and estado = 'pendiente'
  ) then return new; end if;

  select nombre into v_nombre from public.perfiles where id = new.bloqueado_id;

  insert into public.reportes
    (reportante_id, reportado_id, reportado_nombre, motivo, detalle, origen)
  values (null, new.bloqueado_id, v_nombre, 'bloqueos_repetidos',
          format('%s personas distintas han bloqueado a este perfil en 30 dias.', v_distintos),
          'automatico');
  return new;
end; $$;

create trigger bloqueos_senal_automatica
  after insert on public.bloqueos
  for each row execute function public.tg_senal_bloqueos_repetidos();
