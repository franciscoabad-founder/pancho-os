-- Vincula cada KPI opcionalmente con un objetivo de 90 dias.
-- Es aditivo: los KPIs existentes permanecen validos sin objetivo.
alter table if exists public.os_kpis
  add column if not exists objetivo_id uuid references public.os_objetivos(id) on delete set null;

create index if not exists os_kpis_objetivo_id_idx on public.os_kpis(objetivo_id);
