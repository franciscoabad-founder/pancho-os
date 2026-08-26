-- Fase E: estado de animo en cada entrada del diario.
alter table if exists public.os_journal add column if not exists mood text;
create index if not exists os_journal_mood_idx on public.os_journal (mood);
