-- Fase C: pendientes pueden llevar una fecha de compromiso y prioridad.
alter table if exists public.pendientes
  add column if not exists deadline date,
  add column if not exists prioridad text not null default 'medium';

alter table if exists public.pendientes
  drop constraint if exists pendientes_prioridad_check;

alter table if exists public.pendientes
  add constraint pendientes_prioridad_check
  check (prioridad in ('low', 'medium', 'high', 'critical'));

create index if not exists pendientes_deadline_idx
  on public.pendientes(deadline)
  where estado = 'abierto' and deadline is not null;
