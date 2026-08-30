-- Chat soberano del OS (decision os-chat-telegram-soberano, 30 ago 2026).
-- El OS guarda su propio hilo visible (patron Telegram: mensaje entregado,
-- estados simples, respuesta final). state.db de Hermes sigue siendo el
-- registro tecnico; esto es la experiencia de usuario canonica del OS.
-- Aditiva e idempotente, como exige AGENTS.md.

create table if not exists chat_conversaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default 'Nueva conversacion',
  -- Perfil de Hermes que atiende esta conversacion (vps-default, etc.).
  perfil text not null default 'vps-default',
  -- Sesion de Hermes asociada; permite continuidad de contexto del lado del agente.
  hermes_session_id text,
  archivada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references chat_conversaciones(id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant', 'sistema')),
  contenido text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_mensajes_conversacion
  on chat_mensajes (conversacion_id, created_at);

-- Un run por mensaje del usuario: registra el viaje OS -> Hermes -> OS.
-- La evidencia v1 vive aqui como jsonb (duracion, error, sesion), sin tablas
-- extra: run_events/evidence_items quedan para una fase posterior si hacen falta.
create table if not exists chat_runs (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references chat_conversaciones(id) on delete cascade,
  mensaje_user_id uuid not null references chat_mensajes(id) on delete cascade,
  mensaje_assistant_id uuid references chat_mensajes(id) on delete set null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'trabajando', 'completado', 'fallido')),
  error text,
  evidencia jsonb not null default '{}'::jsonb,
  iniciado_at timestamptz not null default now(),
  terminado_at timestamptz
);

create index if not exists idx_chat_runs_conversacion
  on chat_runs (conversacion_id, iniciado_at desc);

comment on table chat_conversaciones is 'Hilos del chat soberano del OS (patron Telegram, ver os-chat-telegram-soberano en el brain)';
comment on table chat_runs is 'Un run por mensaje del usuario: estado del procesamiento en Hermes, con evidencia jsonb';
