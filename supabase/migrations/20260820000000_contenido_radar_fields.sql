-- Content Radar optional metadata columns on os_contenido_ideas.
-- Safe: adds columns only if the table exists; no drops, no data changes.
-- Run this in Supabase SQL editor or via supabase db push.

do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'os_contenido_ideas') then
    execute 'alter table public.os_contenido_ideas add column if not exists source_query text';
    execute 'alter table public.os_contenido_ideas add column if not exists intent text';
    execute 'alter table public.os_contenido_ideas add column if not exists opportunity_score numeric';
    execute 'alter table public.os_contenido_ideas add column if not exists source text';
    execute 'alter table public.os_contenido_ideas add column if not exists cluster text';
    execute 'alter table public.os_contenido_ideas add column if not exists suggested_formats text[]';
    execute 'alter table public.os_contenido_ideas add column if not exists suggested_platforms text[]';
  end if;
end $$;
