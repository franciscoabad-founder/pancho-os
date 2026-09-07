-- OAuth 2.1 para el MCP (Fase MCP-OAuth): registro de clientes, codigos de
-- autorizacion y tokens de acceso/refresh, todo hasheado.
--
-- Que resuelve: hoy el MCP (src/routes/api/mcp.ts) solo acepta el token
-- estatico OS_API_TOKEN / OS_API_TOKENS del .env. Los conectores estandar
-- (Gemini, ChatGPT) esperan pegar una URL y pasar por un flujo OAuth 2.1 con
-- pantalla de consentimiento. Estas tres tablas dan ese flujo sin abrir registro
-- dinamico: los clientes se pre-registran a mano (scripts/mcp-oauth-register.ts)
-- y lo unico que se persiste son hashes sha256, nunca el valor crudo de un
-- secreto, codigo o token.
--
-- Este proyecto aloja tambien el schema gbrain: sin `set search_path`, el DDL
-- cae en el schema equivocado segun el search_path del rol que ejecuta (misma
-- razon que en 20260823000000_os_devices_pairing.sql).
--
-- Safe: solo crea objetos nuevos, no toca datos ni tablas existentes.
-- Idempotente: create table / create index van con IF NOT EXISTS, y tanto
-- `alter table ... enable row level security` como `comment on` son repetibles
-- sin efecto. Correr el archivo dos veces no cambia nada.
-- Apply via docker exec al contenedor pancho-os-postgres contra las dos bases
-- (pancho_os y pancho_os_staging). Verificar la base antes de correr.

set search_path = public;

-- Clientes OAuth pre-registrados. NO hay registro dinamico (DCR) abierto: cada
-- fila la crea a mano scripts/mcp-oauth-register.ts contra el VPS. client_secret
-- se guarda solo como sha256 hex (client_secret_hash); un cliente publico (PKCE
-- sin secreto, como los conectores de navegador) puede tener client_secret_hash
-- nulo. redirect_uris se valida por match EXACTO en el /authorize, por eso es un
-- array cerrado y no un patron.
create table if not exists mcp_oauth_clients (
  client_id text primary key,
  client_secret_hash text,
  client_name text not null,
  redirect_uris text[] not null default '{}',
  grant_types text[] not null default '{authorization_code,refresh_token}',
  scopes text[] not null default '{read}',
  created_at timestamptz not null default now(),
  created_by text
);

-- Codigos de autorizacion. Vida cortisima (60s) y de un solo uso: used_at se
-- setea al canjearlos en /token y una segunda presentacion del mismo codigo se
-- rechaza. code_hash es sha256 hex del codigo crudo, que solo viaja una vez al
-- cliente por el redirect. code_challenge/code_challenge_method guardan el PKCE
-- (solo S256) que se verifica contra el code_verifier en el canje. actor es la
-- identidad que quedara en el token (el client_name), para atribuir la autoria
-- de lo que el agente haga despues.
create table if not exists mcp_oauth_auth_codes (
  code_hash text primary key,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  scope text not null default 'read',
  actor text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  used_at timestamptz
);

-- Tokens emitidos. Un access token y su refresh token viven en la misma fila:
-- access_token_hash y refresh_token_hash son sha256 hex de cada valor crudo.
-- expires_at es la expiracion del ACCESS token (1h); el refresh se rota en cada
-- uso (la fila vieja queda con revoked_at y nace una nueva). revoked_at != null
-- invalida los dos de esa fila (revocacion RFC 7009 o rotacion).
create table if not exists mcp_oauth_tokens (
  access_token_hash text primary key,
  refresh_token_hash text unique,
  client_id text not null,
  scope text not null default 'read',
  actor text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

-- Lookups calientes: el MCP hashea el bearer y busca por access_token_hash entre
-- los no revocados (el primary key ya sirve). El refresh busca por
-- refresh_token_hash (su unique ya crea indice). Estos parciales aceleran la
-- limpieza y las listas por cliente.
create index if not exists mcp_oauth_tokens_client_idx on mcp_oauth_tokens (client_id);
create index if not exists mcp_oauth_tokens_expires_idx on mcp_oauth_tokens (expires_at);
create index if not exists mcp_oauth_auth_codes_expires_idx on mcp_oauth_auth_codes (expires_at);

-- RLS igual que el resto de las tablas nuevas del repo
-- (20260823000000_os_devices_pairing.sql): RLS ON y CERO policies. El unico que
-- las toca es el servidor con la service role key, que bypassea RLS por
-- definicion; el cliente browser jamas les habla directo. Con RLS habilitada y
-- sin policies, cualquier acceso con la anon key devuelve vacio en vez de filtrar
-- hashes de secretos y tokens.
alter table mcp_oauth_clients enable row level security;
alter table mcp_oauth_auth_codes enable row level security;
alter table mcp_oauth_tokens enable row level security;

comment on table mcp_oauth_clients is 'Clientes OAuth pre-registrados a mano. client_secret_hash = sha256 hex; sin registro dinamico.';
comment on table mcp_oauth_auth_codes is 'Codigos de autorizacion PKCE S256, vida 60s y un solo uso (used_at).';
comment on table mcp_oauth_tokens is 'Access + refresh tokens hasheados (sha256). expires_at es del access; refresh se rota; revoked_at invalida ambos.';

-- Nota de operacion: mcp_oauth_auth_codes y las filas de tokens vencidas no se
-- purgan solas todavia. Son chicas (un agente conectado son pocas filas). Si
-- crecen, va como job de pg_cron, no como delete manual:
--   delete from mcp_oauth_auth_codes where expires_at < now() - interval '1 day';
--   delete from mcp_oauth_tokens where revoked_at is not null and expires_at < now() - interval '30 days';

-- Ask PostgREST to reload its schema cache para que las tablas nuevas sean
-- consultables de inmediato (Supabase escucha en el canal pgrst).
notify pgrst, 'reload schema';
