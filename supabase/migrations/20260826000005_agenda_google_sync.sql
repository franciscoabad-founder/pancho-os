-- Fase F: identificadores de sincronizacion Google Calendar.
alter table if exists public.reuniones
  add column if not exists google_event_id text,
  add column if not exists google_etag text,
  add column if not exists google_updated_at timestamptz;

create unique index if not exists reuniones_google_event_id_uq
  on public.reuniones(google_event_id)
  where google_event_id is not null;
