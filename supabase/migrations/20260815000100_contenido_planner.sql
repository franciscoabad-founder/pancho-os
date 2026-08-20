-- Content Planner tables (Listen -> Shape -> Ship -> Learn).
-- Six entities from the Content Planner kit. Prefix contenido_.
-- No tenant_id: OS operational tables are single-tenant and use the service role.

-- Este proyecto aloja tambien el schema gbrain: sin esta linea, el DDL cae en
-- el schema equivocado segun el search_path del rol que ejecuta.
set search_path = public;

create or replace function contenido_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists contenido_signals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  exact_words text not null,
  source text,
  audience_moment text,
  tension text,
  strength integer check (strength is null or (strength >= 1 and strength <= 5)),
  theme text,
  status text not null default 'new'
    check (status in ('new', 'ready', 'in_use', 'archived')),
  captured_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contenido_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text,
  offer text,
  audience text,
  promise text,
  cta text,
  start_date date,
  end_date date,
  primary_kpi text,
  target numeric,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contenido_weekly_sprints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  week_of date not null,
  capacity integer not null default 3 check (capacity >= 0),
  focus text,
  campaign_id uuid references contenido_campaigns (id) on delete set null,
  planned_pieces integer not null default 0 check (planned_pieces >= 0),
  shipped_pieces integer not null default 0 check (shipped_pieces >= 0),
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contenido_stories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  signal_id uuid references contenido_signals (id) on delete set null,
  campaign_id uuid references contenido_campaigns (id) on delete set null,
  sprint_id uuid references contenido_weekly_sprints (id) on delete set null,
  parent_story_id uuid references contenido_stories (id) on delete set null,
  channel text,
  format text,
  stage text not null default 'brief'
    check (stage in ('brief', 'shaping', 'ready', 'scheduled', 'live')),
  publish_date date,
  promise text,
  hook text,
  cta text,
  next_action text,
  derivative_status text,
  accessibility_check text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_story_id is distinct from id)
);

create table if not exists contenido_proof_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  source text,
  rights_status text
    check (rights_status is null or rights_status in (
      'unknown', 'internal_reference_only', 'cleared', 'restricted'
    )),
  claim text,
  file_or_url text,
  captured_on date,
  expiry date,
  story_id uuid references contenido_stories (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contenido_results (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  story_id uuid not null references contenido_stories (id) on delete cascade,
  published_on date,
  primary_kpi text,
  kpi_result numeric,
  reach_or_views numeric,
  saves numeric,
  replies_or_comments numeric,
  clicks numeric,
  leads numeric,
  sales numeric,
  audience_language text,
  verdict text check (verdict is null or verdict in ('reuse', 'refine', 'retire')),
  next_test text,
  repurpose_queue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contenido_sprints_campaign_id_idx on contenido_weekly_sprints (campaign_id);
-- Un sprint por semana civil: la app valida antes de insertar y este indice
-- es la red de seguridad ante dobles clics o retries concurrentes.
create unique index if not exists contenido_sprints_week_of_key on contenido_weekly_sprints (week_of);
create index if not exists contenido_sprints_week_of_idx on contenido_weekly_sprints (week_of);
create index if not exists contenido_stories_signal_id_idx on contenido_stories (signal_id);
create index if not exists contenido_stories_campaign_id_idx on contenido_stories (campaign_id);
create index if not exists contenido_stories_sprint_id_idx on contenido_stories (sprint_id);
create index if not exists contenido_stories_parent_story_id_idx on contenido_stories (parent_story_id);
create index if not exists contenido_stories_stage_idx on contenido_stories (stage);
create index if not exists contenido_stories_publish_date_idx on contenido_stories (publish_date);
create index if not exists contenido_proof_assets_story_id_idx on contenido_proof_assets (story_id);
create index if not exists contenido_results_story_id_idx on contenido_results (story_id);
create index if not exists contenido_results_verdict_idx on contenido_results (verdict);

create or replace trigger contenido_signals_updated_at
  before update on contenido_signals
  for each row execute function contenido_set_updated_at();

create or replace trigger contenido_campaigns_updated_at
  before update on contenido_campaigns
  for each row execute function contenido_set_updated_at();

create or replace trigger contenido_weekly_sprints_updated_at
  before update on contenido_weekly_sprints
  for each row execute function contenido_set_updated_at();

create or replace trigger contenido_stories_updated_at
  before update on contenido_stories
  for each row execute function contenido_set_updated_at();

create or replace trigger contenido_proof_assets_updated_at
  before update on contenido_proof_assets
  for each row execute function contenido_set_updated_at();

create or replace trigger contenido_results_updated_at
  before update on contenido_results
  for each row execute function contenido_set_updated_at();

alter table contenido_signals enable row level security;
alter table contenido_campaigns enable row level security;
alter table contenido_weekly_sprints enable row level security;
alter table contenido_stories enable row level security;
alter table contenido_proof_assets enable row level security;
alter table contenido_results enable row level security;

comment on table contenido_signals is 'Exact audience language captured in Listen.';
comment on table contenido_campaigns is 'Objective, offer, promise, CTA, and success target.';
comment on table contenido_weekly_sprints is 'Real weekly capacity and focus. Capacity remaining is computed, not stored.';
comment on table contenido_stories is 'Parent and derivative pieces with stage, date, and next action.';
comment on table contenido_proof_assets is 'Evidence and reusable assets with rights status.';
comment on table contenido_results is 'Learn loop: metric, verdict Reuse/Refine/Retire, reuse queue.';

-- PostgREST schema cache reload (Supabase listens on the pgrst channel).
notify pgrst, 'reload schema';
