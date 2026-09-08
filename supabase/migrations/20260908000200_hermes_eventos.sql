-- Eventos que Hermes le empuja al OS (F4, 8 sep 2026).
--
-- Hasta F3 el flujo era de una sola via: el OS le habla a Hermes y espera. Si
-- Hermes terminaba una tarea en background, mandaba un mensaje proactivo por
-- Telegram o se encontraba con algo digno de avisar, el OS no se enteraba
-- nunca. Esta tabla es el buzon de esa via que faltaba.
--
-- El cuerpo entero del webhook se guarda en `payload` a proposito: Hermes va a
-- ir agregando tipos de evento y no queremos una migracion por cada campo
-- nuevo. Las columnas de arriba son solo lo que el OS necesita para enrutar
-- (a que tema pertenece) y para la campana (que mostrar, si ya se leyo).
--
-- session_key es la bisagra con F3: si el evento trae la clave de un tema (la
-- propia `os:<perfil>:<uuid8>` o la de un topic de Telegram), el OS puede
-- pegarle el evento al tema correcto sin que Hermes conozca los ids del OS.
--
-- Aditiva e idempotente, como exige AGENTS.md.

create table if not exists hermes_eventos (
  id uuid primary key default gen_random_uuid(),
  perfil_hermes text,
  session_id text,
  session_key text,
  tipo text not null,
  titulo text,
  payload jsonb not null default '{}'::jsonb,
  leido boolean not null default false,
  created_at timestamptz not null default now()
);

-- Los CHECK y las columnas van aparte por si la tabla ya existia de una
-- corrida anterior: `create table if not exists` no agrega columnas nuevas.
alter table hermes_eventos add column if not exists perfil_hermes text;
alter table hermes_eventos add column if not exists session_id text;
alter table hermes_eventos add column if not exists session_key text;
alter table hermes_eventos add column if not exists titulo text;
alter table hermes_eventos add column if not exists payload jsonb not null default '{}'::jsonb;
alter table hermes_eventos add column if not exists leido boolean not null default false;
alter table hermes_eventos add column if not exists created_at timestamptz not null default now();

-- Consulta principal: la campana pide los no leidos, mas reciente primero.
create index if not exists idx_hermes_eventos_leido_created
  on hermes_eventos (leido, created_at desc);

-- Enrutado al tema: registrarEvento busca la conversacion por session_key.
create index if not exists idx_hermes_eventos_session_key
  on hermes_eventos (session_key);
