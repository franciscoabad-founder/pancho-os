-- Modulo Networking Room (nombre de UI; prefijo de tabla se queda "red" por
-- ser el nombre corto del dominio -- Willburn/Ibarra & Hunter). Igual que
-- Ikigai: CERO FK hacia otras tablas del OS, para poder extraerse a Nerio.
--
-- Marco: Leader Network Diagnostic (Phil Willburn) + tipos de vinculo de
-- Ibarra & Hunter (HBR). Hasta 16 personas, 3 dimensiones (area, cercania,
-- tipo de lazo) mas el grafo de quien-conoce-a-quien.
--
-- Safe: solo crea objetos nuevos. Idempotente: todo IF NOT EXISTS.

set search_path = public;

create table if not exists os_red_personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  iniciales text,
  area text not null default 'general',
  cercania smallint not null default 2 check (cercania between 1 and 3),
  tipo_lazo text not null check (tipo_lazo in ('operacional', 'personal', 'estrategico')),
  ultima_interaccion date,
  frecuencia_dias int not null default 30 check (frecuencia_dias > 0),
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists os_red_personas_activo_idx on os_red_personas (activo);
create index if not exists os_red_personas_area_idx on os_red_personas (area);

-- Conexion NO dirigida: persona_a y persona_b se conocen entre si. Se
-- normaliza persona_a < persona_b en el handler antes de insertar, para que
-- el unique index de abajo evite la fila espejo (A,B) y (B,A) como
-- duplicados distintos.
create table if not exists os_red_conexiones (
  id uuid primary key default gen_random_uuid(),
  persona_a uuid not null references os_red_personas(id) on delete cascade,
  persona_b uuid not null references os_red_personas(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (persona_a <> persona_b)
);

create unique index if not exists os_red_conexiones_par_uidx
  on os_red_conexiones (persona_a, persona_b);

-- Un plan activo a la vez (igual patron que ikigai_mapas.activo), pero aca
-- SI puede haber varios planes historicos sin marcar activo=false a mano --
-- el indice solo obliga unicidad entre los activos.
create table if not exists os_red_planes (
  id uuid primary key default gen_random_uuid(),
  meta text not null,
  horizonte_fin date,
  frontera text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists os_red_planes_activo_uidx
  on os_red_planes (activo) where activo;

create table if not exists os_red_objetivos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references os_red_planes(id) on delete cascade,
  persona_id uuid not null references os_red_personas(id) on delete cascade,
  tactica text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'logrado')),
  created_at timestamptz not null default now(),
  unique (plan_id, persona_id)
);

create index if not exists os_red_objetivos_plan_idx on os_red_objetivos (plan_id);

alter table os_red_personas enable row level security;
alter table os_red_conexiones enable row level security;
alter table os_red_planes enable row level security;
alter table os_red_objetivos enable row level security;

comment on table os_red_personas is 'Networking Room: personas de la red personal (max 16 recomendado por el diagnostico de Willburn, no forzado en DB).';
comment on table os_red_conexiones is 'Grafo no dirigido: que personas de la red se conocen entre si. Insumo del calculo de apertura.';
comment on table os_red_planes is 'Plan de red activo: meta, frontera a cruzar, horizonte.';
comment on table os_red_objetivos is 'Personas objetivo dentro de un plan, con tactica de abordaje.';

notify pgrst, 'reload schema';
