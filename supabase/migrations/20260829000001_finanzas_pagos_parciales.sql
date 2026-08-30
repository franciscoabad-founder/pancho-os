-- Fase K: ledger auditable de pagos parciales para por_cobrar.
-- Aditiva e idempotente. Aplicar en pancho_os y pancho_os_staging del VPS.
create table if not exists public.por_cobrar_pagos (
  id uuid primary key default gen_random_uuid(),
  por_cobrar_id uuid not null references public.por_cobrar(id) on delete cascade,
  monto numeric not null check (monto > 0),
  moneda text not null default 'USD',
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists por_cobrar_pagos_cobro_idx on public.por_cobrar_pagos(por_cobrar_id, fecha desc);
do $$ begin
  execute 'grant all on public.por_cobrar_pagos to service_role, authenticated, anon';
exception when undefined_object then null; end $$;
