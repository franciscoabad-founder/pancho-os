-- Content Radar: observed-source traceability columns on os_contenido_ideas.
-- Safe: adds columns only if the table exists; no drops, no data changes.
-- Idempotent: every statement uses IF NOT EXISTS.
-- Apply in the Supabase SQL editor or via `supabase db push` against the
-- correct project. Verify the project ref before running.

do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'os_contenido_ideas') then
    execute 'alter table public.os_contenido_ideas add column if not exists observed_sources text[]';
    execute 'alter table public.os_contenido_ideas add column if not exists captured_at timestamptz';
    execute 'alter table public.os_contenido_ideas add column if not exists source_metadata jsonb';
  end if;
end $$;

-- Ask PostgREST to reload its schema cache so the new columns are writable
-- immediately (Supabase listens on the pgrst channel).
notify pgrst, 'reload schema';
