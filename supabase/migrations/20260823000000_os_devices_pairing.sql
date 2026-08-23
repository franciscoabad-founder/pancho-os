-- Pairing por dispositivo (Fase 2.1): os_devices + os_pairing_requests.
--
-- Que resuelve: hoy la unica auth de agente/dispositivo es OS_API_TOKENS, texto
-- plano en el .env del VPS. Revocar una key exige editar el archivo y reiniciar
-- PM2, y no hay ni un dato de quien la usa ni de cuando la uso por ultima vez.
-- Estas dos tablas dan tokens hasheados, revocables desde la UI y con
-- last_seen_at. Es ADITIVO: OS_API_TOKENS sigue funcionando igual.
--
-- Este proyecto aloja tambien el schema gbrain: sin `set search_path`, el DDL
-- cae en el schema equivocado segun el search_path del rol que ejecuta (misma
-- razon que en 20260815000100_contenido_planner.sql).
--
-- Safe: solo crea objetos nuevos, no toca datos ni tablas existentes.
-- Idempotente: create table / create index van con IF NOT EXISTS, y tanto
-- `alter table ... enable row level security` como `comment on` son repetibles
-- sin efecto. Correr el archivo dos veces no cambia nada.
-- Apply en el SQL editor de Supabase o via `supabase db push` contra el
-- proyecto correcto. Verificar el project ref antes de correr.

set search_path = public;

-- Dispositivos emparejados. token_hash es sha256 hex del token crudo: el token
-- en claro NUNCA se guarda, ni aca ni en os_pairing_requests (ver
-- src/server/deviceAuth.ts). revoked_at en vez de delete para conservar la
-- auditoria de que existio y cuando dejo de valer.
create table if not exists os_devices (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  kind text not null check (kind in ('desktop', 'android', 'agent', 'browser')),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_via text
);

-- Solicitudes de pairing. Ciclo de vida:
--   1. pair/start   -> fila con code y expires_at (created_at + 10 minutos)
--   2. pair/confirm -> token_hash + confirmed_at, y nace la fila en os_devices
--   3. pair/status  -> delivered_at, una sola vez; despues el token no se puede
--                      volver a pedir por este canal
--
-- token_hash arranca nulo a proposito: recien al confirmar existe un token.
create table if not exists os_pairing_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[0-9]{6}$'),
  kind text not null check (kind in ('desktop', 'android', 'agent', 'browser')),
  label text,
  token_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  confirmed_at timestamptz,
  delivered_at timestamptz
);

-- El lookup caliente: isOsAuthorized() hashea el bearer y busca por token_hash
-- entre los no revocados. El unique de token_hash ya crea su indice, asi que
-- aca solo hace falta el parcial por revoked_at para las listas de la UI.
create index if not exists os_devices_revoked_at_idx on os_devices (revoked_at);
create index if not exists os_devices_last_seen_at_idx on os_devices (last_seen_at desc nulls last);

-- UNICIDAD DEL CODIGO, y es unique de verdad, no una convencion de la app.
--
-- Sin esto la unicidad seria un check-then-insert sin transaccion: dos
-- pair/start concurrentes pueden plantar el mismo codigo vivo, y ahi
-- pair/confirm ya no sabe cual de las dos solicitudes esta aprobando Pancho.
-- Ese es un secuestro de pairing, no una molestia: el que confirma es Pancho,
-- pero el token se lo lleva quien tenga el otro device_id.
--
-- Es parcial (`where confirmed_at is null`) porque el codigo solo tiene que ser
-- unico mientras la solicitud esta abierta. Una vez confirmada, su codigo queda
-- libre para reaparecer. No se puede filtrar tambien por expires_at: un indice
-- parcial no admite now(), que no es inmutable. Consecuencia practica: una
-- solicitud vencida y nunca confirmada sigue ocupando su codigo, y por eso
-- devices.handlers.ts purga esas filas (ver purgarPairingsVencidos).
--
-- iniciarPairing() inserta y reintenta con otro codigo si Postgres devuelve
-- 23505, en vez de consultar antes. Un round trip en vez de siete, y la carrera
-- la resuelve la base.
create unique index if not exists os_pairing_requests_code_abierto_idx
  on os_pairing_requests (code)
  where confirmed_at is null;

-- pair/confirm busca por code entre las pendientes no vencidas; el indice de
-- arriba ya sirve para eso. Este es para la purga y para el chequeo de cuantas
-- solicitudes vivas hay (el tope que frena el abuso de pair/start, que es
-- publico).
create index if not exists os_pairing_requests_expires_at_idx on os_pairing_requests (expires_at);

-- RLS igual que el resto de las tablas nuevas de este repo
-- (20260815000100_contenido_planner.sql las habilita todas): RLS ON y CERO
-- policies. El unico que las toca es el servidor con la service role key, que
-- bypassea RLS por definicion; el cliente browser jamas les habla directo. Con
-- RLS habilitada y sin policies, cualquier acceso con la anon key (que viaja al
-- navegador) devuelve vacio en vez de filtrar hashes de tokens.
alter table os_devices enable row level security;
alter table os_pairing_requests enable row level security;

comment on table os_devices is 'Dispositivos y agentes emparejados. token_hash = sha256 hex; el token crudo no se persiste.';
comment on table os_pairing_requests is 'Pairing de 6 digitos con vida de 10 minutos y entrega unica del token (delivered_at).';
comment on column os_devices.created_via is 'Origen del alta: pairing, seed, manual.';
comment on column os_pairing_requests.delivered_at is 'Se marca cuando el dispositivo nuevo se lleva el token. Una sola vez.';

-- Nota de operacion: os_pairing_requests no crece sola. La app purga las filas
-- vencidas y nunca confirmadas (las unicas que no valen nada como auditoria y
-- que ademas bloquean su codigo) de forma oportunista al arrancar un pairing.
-- Las confirmadas se conservan: son el registro de cuando nacio cada
-- dispositivo. Si algun dia hace falta una limpieza mas agresiva, va como job
-- de pg_cron, no como delete manual:
--   delete from os_pairing_requests
--    where confirmed_at is null and expires_at < now() - interval '1 hour';

-- Ask PostgREST to reload its schema cache para que las tablas nuevas sean
-- consultables de inmediato (Supabase escucha en el canal pgrst).
notify pgrst, 'reload schema';
