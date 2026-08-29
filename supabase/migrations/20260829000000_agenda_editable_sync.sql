-- Agenda editable y sincronizacion Google resiliente.
-- Aditiva e idempotente: no relaja RLS ni crea acceso publico nuevo.

alter table if exists public.reuniones
  add column if not exists google_event_id text,
  add column if not exists google_etag text,
  add column if not exists google_updated_at timestamptz,
  add column if not exists google_dirty_at timestamptz,
  add column if not exists google_deleted_at timestamptz,
  add column if not exists etiquetas text[] not null default '{}';

create unique index if not exists reuniones_google_event_id_uq
  on public.reuniones(google_event_id)
  where google_event_id is not null;

create index if not exists reuniones_fecha_visible_idx
  on public.reuniones(fecha)
  where google_deleted_at is null;

create index if not exists reuniones_etiquetas_gin_idx
  on public.reuniones using gin(etiquetas);
