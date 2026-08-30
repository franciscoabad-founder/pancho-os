-- Reset operativo de deuda sin borrar historial de sueño.
alter table if exists sueno_config
  add column if not exists deuda_desde date;

comment on column sueno_config.deuda_desde is
  'Primer día incluido en la deuda actual; el historial anterior se conserva.';
