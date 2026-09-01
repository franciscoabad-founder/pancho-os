-- Feed unificado de tareas: comentarios humanos, comentarios de Hermes y
-- eventos de sistema (cambios de campo) en una sola tabla, porque el panel de
-- detalle renderiza una unica linea de tiempo cronologica ("Hermes movio a
-- bloqueada" + "Hermes: el cliente no responde" solo tienen sentido juntos).

create table if not exists tarea_eventos (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references tareas(id) on delete cascade,
  tipo text not null check (tipo in ('comentario', 'cambio', 'sistema')),
  autor text,
  autor_tipo text,
  origen text,
  cuerpo text,
  cambios jsonb,
  meta jsonb,
  created_at timestamptz not null default now(),
  editado_at timestamptz,
  -- Forma explicita por tipo: un comentario necesita texto no vacio, un
  -- cambio necesita el jsonb de campos, un evento de sistema no exige nada
  -- ademas de su tipo.
  constraint tarea_eventos_forma_check check (
    (tipo = 'comentario' and btrim(coalesce(cuerpo, '')) <> '')
    or (tipo = 'cambio' and cambios is not null)
    or (tipo = 'sistema')
  )
);

-- Un PATCH que cambia varios campos genera UN evento de tipo 'cambio' con
-- `cambios` como jsonb (no una fila por campo). Con eso, dos eventos del
-- mismo tarea_id no deberian compartir instante: el indice unico ademas
-- protege contra un doble-submit del mismo comentario en la misma
-- transaccion.
create unique index if not exists tarea_eventos_tarea_created_uidx
  on tarea_eventos (tarea_id, created_at desc);

-- Replica los mismos privilegios de tareas (no se puede asumir que una tabla
-- nueva hereda permisos correctos solo porque tareas los tiene): RLS
-- habilitado, sin policies, el owner (pancho_os, el rol con el que conecta
-- PostgREST) sigue teniendo acceso pleno por ser el dueño de la tabla.
alter table tarea_eventos enable row level security;
