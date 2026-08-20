// Content Planner: entity sanitizers, desk helpers and server-side weekly rule.
// Pure functions, no Supabase client here: the API routes do the IO.

import {
  SIGNAL_STATUSES,
  CAMPAIGN_STATUSES,
  SPRINT_STATUSES,
  STORY_STAGES,
  VERDICTS,
  RIGHTS_STATUSES,
  isValidStrength,
  type Story,
} from './types.ts';
import { isStoryStage, canTransition } from './stages.ts';
import { validateWeeklyRule, type WeeklyValidation } from './weekly.ts';

export const PLANNER_ENTITIES = [
  'signals',
  'campaigns',
  'sprints',
  'stories',
  'assets',
  'results',
] as const;
export type PlannerEntity = (typeof PLANNER_ENTITIES)[number];

export const ENTITY_TABLE: Record<PlannerEntity, string> = {
  signals: 'contenido_signals',
  campaigns: 'contenido_campaigns',
  sprints: 'contenido_weekly_sprints',
  stories: 'contenido_stories',
  assets: 'contenido_proof_assets',
  results: 'contenido_results',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 500;
const MAX_LONG_TEXT = 5000;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function text(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function date(v: unknown): string | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && DATE_RE.test(v.trim())) return v.trim();
  return 'invalid';
}

function num(v: unknown): number | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n === 'number' && Number.isFinite(n)) return n;
  return 'invalid';
}

function int(v: unknown): number | null | 'invalid' {
  const n = num(v);
  if (n === null || n === 'invalid') return n;
  return Number.isInteger(n) ? n : 'invalid';
}

function fk(v: unknown): string | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  return isUuid(v) ? v : 'invalid';
}

function enumVal<T extends string>(v: unknown, allowed: readonly T[]): T | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T;
  return 'invalid';
}

export type SanitizeResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string };

interface FieldSpec {
  column: string;
  kind: 'text' | 'longtext' | 'date' | 'number' | 'int' | 'fk' | 'enum';
  required?: boolean;
  enumValues?: readonly string[];
}

const SPECS: Record<PlannerEntity, FieldSpec[]> = {
  signals: [
    { column: 'name', kind: 'text', required: true },
    { column: 'exact_words', kind: 'longtext', required: true },
    { column: 'source', kind: 'text' },
    { column: 'audience_moment', kind: 'text' },
    { column: 'tension', kind: 'longtext' },
    { column: 'strength', kind: 'int' },
    { column: 'theme', kind: 'text' },
    { column: 'status', kind: 'enum', enumValues: SIGNAL_STATUSES },
    { column: 'captured_on', kind: 'date' },
  ],
  campaigns: [
    { column: 'name', kind: 'text', required: true },
    { column: 'objective', kind: 'longtext' },
    { column: 'offer', kind: 'longtext' },
    { column: 'audience', kind: 'text' },
    { column: 'promise', kind: 'longtext' },
    { column: 'cta', kind: 'text' },
    { column: 'start_date', kind: 'date' },
    { column: 'end_date', kind: 'date' },
    { column: 'primary_kpi', kind: 'text' },
    { column: 'target', kind: 'number' },
    { column: 'status', kind: 'enum', enumValues: CAMPAIGN_STATUSES },
  ],
  sprints: [
    { column: 'name', kind: 'text', required: true },
    { column: 'week_of', kind: 'date', required: true },
    { column: 'capacity', kind: 'int' },
    { column: 'focus', kind: 'longtext' },
    { column: 'campaign_id', kind: 'fk' },
    { column: 'status', kind: 'enum', enumValues: SPRINT_STATUSES },
    // planned_pieces / shipped_pieces son derivados de contenido_stories;
    // no se aceptan del cliente.
  ],
  stories: [
    { column: 'name', kind: 'text', required: true },
    { column: 'signal_id', kind: 'fk' },
    { column: 'campaign_id', kind: 'fk' },
    { column: 'sprint_id', kind: 'fk' },
    { column: 'parent_story_id', kind: 'fk' },
    { column: 'channel', kind: 'text' },
    { column: 'format', kind: 'text' },
    { column: 'stage', kind: 'enum', enumValues: STORY_STAGES },
    { column: 'publish_date', kind: 'date' },
    { column: 'promise', kind: 'longtext' },
    { column: 'hook', kind: 'longtext' },
    { column: 'cta', kind: 'text' },
    { column: 'next_action', kind: 'text' },
    { column: 'derivative_status', kind: 'text' },
    { column: 'accessibility_check', kind: 'text' },
  ],
  assets: [
    { column: 'name', kind: 'text', required: true },
    { column: 'type', kind: 'text' },
    { column: 'source', kind: 'text' },
    { column: 'rights_status', kind: 'enum', enumValues: RIGHTS_STATUSES },
    { column: 'claim', kind: 'longtext' },
    { column: 'file_or_url', kind: 'text' },
    { column: 'captured_on', kind: 'date' },
    { column: 'expiry', kind: 'date' },
    { column: 'story_id', kind: 'fk' },
    { column: 'notes', kind: 'longtext' },
  ],
  results: [
    { column: 'name', kind: 'text', required: true },
    { column: 'story_id', kind: 'fk', required: true },
    { column: 'published_on', kind: 'date' },
    { column: 'primary_kpi', kind: 'text' },
    { column: 'kpi_result', kind: 'number' },
    { column: 'reach_or_views', kind: 'number' },
    { column: 'saves', kind: 'number' },
    { column: 'replies_or_comments', kind: 'number' },
    { column: 'clicks', kind: 'number' },
    { column: 'leads', kind: 'number' },
    { column: 'sales', kind: 'number' },
    { column: 'audience_language', kind: 'longtext' },
    { column: 'verdict', kind: 'enum', enumValues: VERDICTS },
    { column: 'next_test', kind: 'text' },
    { column: 'repurpose_queue', kind: 'longtext' },
  ],
};

function convertField(spec: FieldSpec, value: unknown): unknown {
  switch (spec.kind) {
    case 'text':
      return value === undefined ? undefined : text(value);
    case 'longtext':
      return value === undefined ? undefined : text(value, MAX_LONG_TEXT);
    case 'date':
      return value === undefined ? undefined : date(value);
    case 'number':
      return value === undefined ? undefined : num(value);
    case 'int':
      return value === undefined ? undefined : int(value);
    case 'fk':
      return value === undefined ? undefined : fk(value);
    case 'enum':
      return value === undefined ? undefined : enumVal(value, spec.enumValues ?? []);
  }
}

/**
 * Validates and whitelists a client payload for an entity.
 * partial=false (POST): required fields must be present.
 * partial=true (PATCH): only provided fields are validated.
 * Only whitelisted columns survive: no arbitrary fields reach Supabase.
 */
export function sanitizeEntity(entity: PlannerEntity, body: unknown, partial: boolean): SanitizeResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'cuerpo invalido' };
  }
  const input = body as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const spec of SPECS[entity]) {
    const value = convertField(spec, input[spec.column]);
    if (value === 'invalid') return { ok: false, error: `campo invalido: ${spec.column}` };
    if (value === undefined) {
      if (!partial && spec.required) return { ok: false, error: `campo requerido: ${spec.column}` };
      continue;
    }
    if (!partial && spec.required && value === null) {
      return { ok: false, error: `campo requerido: ${spec.column}` };
    }
    row[spec.column] = value;
  }
  if (entity === 'signals' && row.strength !== undefined && row.strength !== null) {
    if (!isValidStrength(row.strength as number)) {
      return { ok: false, error: 'strength debe ser un entero entre 1 y 5' };
    }
  }
  if (entity === 'sprints' && row.capacity !== undefined && row.capacity !== null) {
    if ((row.capacity as number) < 0) return { ok: false, error: 'capacity debe ser >= 0' };
  }
  if (partial && Object.keys(row).length === 0) {
    return { ok: false, error: 'sin campos para actualizar' };
  }
  return { ok: true, row };
}

/** Stage transitions are only validated when the client moves the stage. */
export function validateStageChange(
  currentStage: string,
  patch: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  if (!('stage' in patch) || patch.stage === undefined) return { ok: true };
  const to = patch.stage;
  if (to === null) return { ok: false, error: 'stage no puede ser null' };
  if (typeof to !== 'string' || !isStoryStage(to)) return { ok: false, error: 'stage invalido' };
  if (!isStoryStage(currentStage)) return { ok: false, error: `etapa actual desconocida: ${currentStage}` };
  if (to === currentStage) return { ok: true };
  if (!canTransition(currentStage, to)) {
    return { ok: false, error: `transicion no permitida: ${currentStage} -> ${to}` };
  }
  return { ok: true };
}

/**
 * Server-side weekly rule: validates that assigning `candidate` to a sprint
 * keeps the sprint within one parent story and three pieces.
 */
export function validateSprintAssignment(
  sprintStories: readonly Story[],
  candidate: Story,
): WeeklyValidation {
  const others = sprintStories.filter((s) => s.id !== candidate.id);
  return validateWeeklyRule([...others, candidate]);
}

/**
 * Monday (YYYY-MM-DD) of the week containing `now`, in the given civil
 * timezone (default America/Guayaquil, UTC-5). Using the civil date matters:
 * Sunday 19:00-23:59 in Ecuador is already Monday in UTC, and the Desk must
 * not jump to next week early.
 */
export function weekMonday(now: Date | string, timeZone = 'America/Guayaquil'): string {
  // Fecha civil (YYYY-MM-DD) se ancla a mediodia UTC; un ISO completo se respeta.
  const d = typeof now === 'string'
    ? new Date(now.includes('T') ? now : `${now.slice(0, 10)}T12:00:00Z`)
    : now;
  const civil = d.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD
  const base = new Date(`${civil}T12:00:00Z`);
  const day = base.getUTCDay(); // 0=Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

/** Today's civil date (YYYY-MM-DD) in the given timezone. */
export function todayIn(timeZone = 'America/Guayaquil'): string {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}
