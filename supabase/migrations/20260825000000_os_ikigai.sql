-- Modulo Ikigai: proposito personal, versionable. Diseñado para vivir SIN
-- ninguna FK hacia otras tablas del OS, a proposito -- este dominio se piensa
-- para extraerse a Nerio como paquete vendible aparte, y una FK externa
-- rompería ese lift-and-shift. La unica conexion a os_objetivos (norte de 90
-- dias) es un id de texto libre guardado en el cliente, nunca una FK real.
--
-- Cada rediagnostico completo crea un `mapa` NUEVO (version+1), el anterior
-- queda intacto para poder comparar deriva entre versiones. `activo` marca
-- cual es el vigente; solo puede haber uno activo a la vez, lo garantiza el
-- indice parcial unico de abajo.
--
-- Safe: solo crea objetos nuevos. Idempotente: todo IF NOT EXISTS.

set search_path = public;

create table if not exists os_ikigai_mapas (
  id uuid primary key default gen_random_uuid(),
  version int not null,
  titulo text,
  nota text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists os_ikigai_mapas_activo_uidx
  on os_ikigai_mapas (activo) where activo;

create table if not exists os_ikigai_items (
  id uuid primary key default gen_random_uuid(),
  mapa_id uuid not null references os_ikigai_mapas(id) on delete cascade,
  cuadrante text not null check (cuadrante in ('amas', 'bueno', 'pagan', 'mundo')),
  texto text not null,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists os_ikigai_items_mapa_idx on os_ikigai_items (mapa_id);

-- Una zona de vida (ej: "BrainTech", "Familia") declara a que cuadrantes
-- sirve. cuadrantes va como text[] en vez de tabla puente: el cardinal es
-- bajo (4 valores posibles) y la consulta de cobertura es mas simple sobre
-- un array que sobre un join.
create table if not exists os_ikigai_zonas (
  id uuid primary key default gen_random_uuid(),
  mapa_id uuid not null references os_ikigai_mapas(id) on delete cascade,
  nombre text not null,
  cuadrantes text[] not null default '{}',
  descripcion text,
  objetivo_ref text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists os_ikigai_zonas_mapa_idx on os_ikigai_zonas (mapa_id);

-- Pulso mensual: un slider 1-5 por zona. periodo = 'YYYY-MM'. Unico por
-- (zona, periodo): repetir el pulso del mes actualiza el existente, no
-- duplica.
create table if not exists os_ikigai_pulsos (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references os_ikigai_zonas(id) on delete cascade,
  periodo text not null,
  nivel smallint not null check (nivel between 1 and 5),
  nota text,
  created_at timestamptz not null default now(),
  unique (zona_id, periodo)
);

create index if not exists os_ikigai_pulsos_zona_idx on os_ikigai_pulsos (zona_id, periodo desc);

alter table os_ikigai_mapas enable row level security;
alter table os_ikigai_items enable row level security;
alter table os_ikigai_zonas enable row level security;
alter table os_ikigai_pulsos enable row level security;

comment on table os_ikigai_mapas is 'Ikigai: version del diagnostico completo. Un rediagnostico = fila nueva, no update.';
comment on table os_ikigai_items is 'Frases capturadas por cuadrante (amas/bueno/pagan/mundo) dentro de un mapa.';
comment on table os_ikigai_zonas is 'Zonas de vida (proyectos/areas) y que cuadrantes satisfacen.';
comment on table os_ikigai_pulsos is 'Pulso mensual 1-5 por zona, para medir tendencia sin logging pesado.';

notify pgrst, 'reload schema';
