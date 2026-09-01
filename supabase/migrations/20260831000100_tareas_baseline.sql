-- Baseline de `tareas` para el rediseño "Work OS" (Rebanada A).
-- DDL de la tabla existente tomado de `pg_dump --schema-only -t tareas` contra
-- produccion el 2026-08-31 (no se reescribe a mano: asi una base nueva nace
-- identica a la real). Todo lo demas es aditivo.
--
-- Verificado antes de esta migracion (SSH, ambas bases):
--   pancho_os:         0 filas en tareas (clean slate).
--   pancho_os_staging: 106 filas, estado en {pendiente, hecho} -- dentro del
--                       vocabulario de 5 valores de mas abajo, el CHECK no
--                       revienta filas existentes.
--
-- Orden de despliegue (regla del plan aprobado): esta migracion se aplica a
-- pancho_os Y pancho_os_staging, LUEGO un solo `docker restart
-- pancho-os-postgrest`, y recien despues el push del codigo que la usa.

alter table tareas add column if not exists updated_at timestamptz not null default now();
alter table tareas add column if not exists completado_at timestamptz;
alter table tareas add column if not exists visto_hasta timestamptz;
alter table tareas add column if not exists linea_id uuid references os_lineas(id) on delete set null;

-- CHECK de estado: 5 valores. Bloque DO porque no existe
-- `ADD CONSTRAINT IF NOT EXISTS`.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tareas_estado_check') then
    alter table tareas add constraint tareas_estado_check
      check (estado in ('pendiente', 'en_progreso', 'bloqueada', 'hecho', 'cancelada'));
  end if;
end $$;

-- Una sola capa de subtareas: una tarea no puede ser su propio padre. (La
-- regla de "no anidar mas de un nivel" se aplica en el handler, no aca: eso
-- exigiria una consulta recursiva en el CHECK.)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tareas_parent_no_self_check') then
    alter table tareas add constraint tareas_parent_no_self_check check (parent_id <> id);
  end if;
end $$;

-- Solo dos indices nuevos (fable: los demas sobran con tabla vacia y un solo
-- usuario; se agregan el dia que duelan). No se recrean tareas_dedupe_key_uidx
-- ni tareas_parent_idx, que ya existen.
create index if not exists tareas_updated_at_idx on tareas (updated_at desc);
create index if not exists tareas_proyecto_idx on tareas (proyecto);

-- Trigger de mantenimiento: resuelve linea_id desde proyecto (match exacto
-- contra os_lineas.nombre), mantiene updated_at, y completado_at cuando el
-- estado entra o sale de 'hecho'.
--
-- Vive en un trigger y no en el handler porque `tareas` se escribe por fuera
-- del handler nuevo: el RPC capturar_lote (red.puente-tareas.ts) y
-- notas.handlers.ts tambien insertan/actualizan filas directamente. Un solo
-- lugar cubre a todos los escritores, o esas rutas dejarian linea_id null y
-- el dashboard de la Rebanada B reportaria "huerfanas" falsas desde el dia 1.
create or replace function tareas_touch() returns trigger as $$
begin
  new.updated_at := now();

  if new.proyecto is null then
    new.linea_id := null;
  else
    select id into new.linea_id from os_lineas where nombre = new.proyecto limit 1;
  end if;

  if new.estado = 'hecho' then
    if new.completado_at is null then
      new.completado_at := now();
    end if;
  else
    new.completado_at := null;
  end if;

  return new;
end;
$$ language plpgsql;

-- Dos triggers, no uno combinado: Postgres rechaza un WHEN que referencie OLD
-- en un trigger que tambien dispara por INSERT ("INSERT trigger's WHEN
-- condition cannot reference OLD values"), asi que la guarda WHEN solo puede
-- ir en el trigger de UPDATE. El de INSERT no necesita guarda: siempre corre,
-- cubriendo tambien una tarea que nace 'hecho'.
-- CREATE OR REPLACE TRIGGER porque no existe "IF NOT EXISTS" (Postgres 14+).
create or replace trigger tareas_touch_insert
  before insert on tareas
  for each row
  execute function tareas_touch();

create or replace trigger tareas_touch_update
  before update on tareas
  for each row
  when (old is distinct from new)
  execute function tareas_touch();
