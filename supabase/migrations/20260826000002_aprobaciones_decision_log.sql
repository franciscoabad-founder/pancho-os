-- Fase B: historial de decisión y expiración de solicitudes.
alter table if exists public.os_aprobaciones
  add column if not exists decidido_at timestamptz,
  add column if not exists decidido_por text,
  add column if not exists expira_at timestamptz;

create index if not exists os_aprobaciones_pendientes_idx
  on public.os_aprobaciones (estado, expira_at);
