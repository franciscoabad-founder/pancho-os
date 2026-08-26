-- Fase J: vincula gastos a una linea/proyecto del OS.
alter table if exists public.gastos
  add column if not exists proyecto text;

create index if not exists gastos_proyecto_idx on public.gastos(proyecto);

alter table if exists public.por_cobrar add column if not exists proyecto text;
alter table if exists public.por_pagar add column if not exists proyecto text;
create index if not exists por_cobrar_proyecto_idx on public.por_cobrar(proyecto);
create index if not exists por_pagar_proyecto_idx on public.por_pagar(proyecto);
