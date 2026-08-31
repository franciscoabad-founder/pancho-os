-- Configuracion generica del OS, clave-valor. Primer uso: `bottom_nav`, el
-- array de hrefs que Pancho elige para el bottom-nav movil. Pensada para
-- cualquier preferencia futura que no amerite su propia tabla.

create table if not exists os_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
