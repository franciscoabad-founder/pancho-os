-- Fase K: bandeja de entrada para estados de cuenta enviados por n8n.
create table if not exists public.finanzas_inbox (
  id uuid primary key default gen_random_uuid(),
  origen text not null default 'email',
  remitente text,
  asunto text,
  contenido text not null,
  adjuntos jsonb not null default '[]'::jsonb,
  estado text not null default 'pendiente' check (estado in ('pendiente','procesado','descartado')),
  datos_extraidos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finanzas_inbox_estado_idx on public.finanzas_inbox(estado, created_at desc);
do $$ begin execute 'grant all on public.finanzas_inbox to service_role, authenticated, anon'; exception when undefined_object then null; end $$;
