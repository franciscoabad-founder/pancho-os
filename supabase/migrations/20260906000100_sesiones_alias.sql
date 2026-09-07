-- Alias local de sesiones de Hermes (fix/os-chat-sesiones-modelos, 6 sep 2026).
--
-- Renombrar una sesion se intenta primero contra Hermes con
-- PATCH /api/sessions/{id} {"title": "..."} (existe en el api_server: ver
-- gateway/platforms/api_server.py, _handle_patch_session, campo permitido
-- "title"). Si la build desplegada del VPS no lo tiene, o el perfil no
-- responde, el OS guarda el alias aca y lo muestra POR ENCIMA del titulo que
-- devuelve Hermes, para que el nombre que puso Pancho nunca se pierda ni lo
-- pise el auto-titulador (title_generation, el que produce "Friendly greeting").
--
-- Aditiva e idempotente, como exige AGENTS.md.

create table if not exists chat_sesiones_alias (
  -- id de la sesion en Hermes (pancho-os, os-chat-xxxxxxxx, agent:main:telegram:...).
  session_id text not null,
  -- Perfil de Hermes dueno de esa sesion: el mismo id puede existir en el VPS
  -- y en la laptop y ser conversaciones distintas.
  perfil text not null default 'vps-default',
  alias text not null,
  -- true = tambien se logro persistir el titulo en Hermes (PATCH ok).
  sincronizado_hermes boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (perfil, session_id)
);

create index if not exists idx_chat_sesiones_alias_perfil
  on chat_sesiones_alias (perfil);
