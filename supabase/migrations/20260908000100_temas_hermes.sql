-- Temas de Hermes en el chat del OS (F2, 8 sep 2026).
--
-- Hasta F1 el OS solo modelaba NODO (donde corre Hermes: vps-default,
-- homelab-local, laptop-local) y lo guardaba en chat_conversaciones.perfil.
-- Pero Hermes tiene ademas PERFILES reales de agente (default/Alfred, arazza,
-- nerio, rafik, taskr), cada uno con su propio api_server y su propia memoria.
-- Son dos ejes distintos y hasta ahora el OS solo veia uno.
--
-- Esta migracion agrega el eje que faltaba SIN tocar el existente:
--   - perfil        (columna vieja) sigue siendo el NODO. No se toca.
--   - perfil_hermes (columna nueva) es el PERFIL real del agente.
-- Tampoco se toca la PK de chat_sesiones_alias, cuyo `perfil` es nodo.
--
-- session_key es el scope de memoria del lado de Hermes (cabecera
-- X-Hermes-Session-Key). Se persiste al crear el tema para que renombrar la
-- conversacion no le cambie la memoria al agente.
--
-- topic_telegram queda listo para F3 (enganchar un tema del OS con un topic de
-- Telegram): nullable, y unico por perfil solo cuando tiene valor.
--
-- Aditiva e idempotente, como exige AGENTS.md.

alter table chat_conversaciones
  add column if not exists perfil_hermes text not null default 'default';

alter table chat_conversaciones
  add column if not exists session_key text;

alter table chat_conversaciones
  add column if not exists topic_telegram text;

alter table chat_conversaciones
  add column if not exists estado text not null default 'activo';

alter table chat_conversaciones
  add column if not exists ultimo_evento jsonb not null default '{}'::jsonb;

-- Los CHECK van aparte porque `add column ... check` no es idempotente: si la
-- columna ya existia, la restriccion no se crearia nunca.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chat_conversaciones_perfil_hermes_check'
  ) then
    alter table chat_conversaciones
      add constraint chat_conversaciones_perfil_hermes_check
      check (perfil_hermes in ('default', 'arazza', 'nerio', 'rafik', 'taskr'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chat_conversaciones_estado_check'
  ) then
    alter table chat_conversaciones
      add constraint chat_conversaciones_estado_check
      check (estado in ('activo', 'pausado', 'archivado'));
  end if;
end $$;

-- Listado del panel lateral: agrupado por perfil real, mas reciente primero.
create index if not exists idx_chat_conversaciones_perfil_hermes
  on chat_conversaciones (perfil_hermes, updated_at desc);

-- Un topic de Telegram se engancha a un solo tema por perfil (F3). Parcial:
-- los temas sin topic no compiten entre si.
create unique index if not exists idx_chat_conversaciones_topic_telegram
  on chat_conversaciones (perfil_hermes, topic_telegram)
  where topic_telegram is not null;
