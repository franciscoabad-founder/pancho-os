-- Modulo Diario (journaling): bitacora de dias, procesos, decisiones, wins e
-- ideas. Se escribe desde el OS, desde Hermes (MCP), desde Flow (dictado) y
-- desde Android. `publicable` marca la entrada como materia prima de contenido
-- y `brain_slug` guarda la pagina de gbrain donde quedo sincronizada.

create table if not exists os_journal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  fecha date not null default current_date,
  tipo text not null default 'dia' check (tipo in ('dia', 'proceso', 'decision', 'win', 'idea')),
  titulo text,
  contenido text not null,
  tags text[] not null default '{}',
  fuente text not null default 'os',
  proyecto text,
  publicable boolean not null default false,
  brain_slug text
);

create index if not exists os_journal_fecha_idx on os_journal (fecha desc);
create index if not exists os_journal_publicable_idx on os_journal (publicable);
