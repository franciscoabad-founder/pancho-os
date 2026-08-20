export const prerender = false;

// Content Planner CRUD: /api/os/contenido/planner/{entity}
// Entities: signals | campaigns | sprints | stories | assets | results.
// All payloads are whitelisted and validated (sanitizeEntity); stage moves use
// the stage machine; sprint assignments enforce the weekly rule server-side.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../../../lib/supabase';
import { isOsAuthorized, json } from '../../../../../os/lib/osAuth';
import { errMsg } from '../../../../../lib/salud/apiHelpers';
import {
  PLANNER_ENTITIES,
  ENTITY_TABLE,
  sanitizeEntity,
  validateStageChange,
  validateSprintAssignment,
  isUuid,
  type PlannerEntity,
} from '../../../../../lib/contenido/planner.ts';
import type { Story } from '../../../../../lib/contenido/types.ts';

function parseEntity(raw: string | undefined): PlannerEntity | null {
  return (PLANNER_ENTITIES as readonly string[]).includes(raw ?? '') ? (raw as PlannerEntity) : null;
}

const FILTERS: Record<PlannerEntity, Record<string, 'eq' | 'gte'>> = {
  signals: { status: 'eq', theme: 'eq', strength: 'gte' },
  campaigns: { status: 'eq' },
  sprints: { status: 'eq', week_of: 'eq', campaign_id: 'eq' },
  stories: { stage: 'eq', sprint_id: 'eq', signal_id: 'eq', campaign_id: 'eq', parent_story_id: 'eq' },
  assets: { story_id: 'eq', rights_status: 'eq' },
  results: { story_id: 'eq', verdict: 'eq' },
};

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const entity = parseEntity(context.params.entity);
  if (!entity) return json({ error: 'entidad desconocida' }, 404);
  try {
    const sb = getSupabaseServer();
    let query = sb.from(ENTITY_TABLE[entity]).select('*').order('created_at', { ascending: false }).limit(200);
    for (const [param, op] of Object.entries(FILTERS[entity])) {
      const v = context.url.searchParams.get(param);
      if (!v) continue;
      if (op === 'gte') {
        const n = Number(v);
        if (!Number.isFinite(n)) return json({ error: `filtro invalido: ${param}` }, 400);
        query = query.gte(param, n);
      } else {
        query = query.eq(param, v);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    return json({ rows: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const entity = parseEntity(context.params.entity);
  if (!entity) return json({ error: 'entidad desconocida' }, 404);
  try {
    const body = await context.request.json();
    const clean = sanitizeEntity(entity, body, false);
    if (!clean.ok) return json({ error: clean.error }, 400);
    const sb = getSupabaseServer();

    if (entity === 'stories' && typeof clean.row.sprint_id === 'string') {
      const check = await checkWeeklyRule(sb, clean.row.sprint_id, clean.row as Partial<Story>);
      if (check) return check;
    }

    // Un sprint por semana: chequeo previo + indice unico como red de seguridad.
    if (entity === 'sprints' && typeof clean.row.week_of === 'string') {
      const { data: dup } = await sb
        .from('contenido_weekly_sprints')
        .select('id')
        .eq('week_of', clean.row.week_of)
        .limit(1);
      if (dup && dup.length > 0) {
        return json({ error: `ya existe un sprint para la semana ${clean.row.week_of}` }, 409);
      }
    }

    const { data, error } = await sb.from(ENTITY_TABLE[entity]).insert([clean.row]).select().single();
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return json({ error: 'registro duplicado (conflicto de unicidad)' }, 409);
      }
      throw error;
    }

    // Metodo Listen->Shape: una senal usada en una historia pasa a 'in_use'.
    if (entity === 'stories' && typeof clean.row.signal_id === 'string') {
      await markSignalInUse(sb, clean.row.signal_id);
    }

    return json({ row: data }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const entity = parseEntity(context.params.entity);
  if (!entity) return json({ error: 'entidad desconocida' }, 404);
  const id = context.url.searchParams.get('id');
  if (!isUuid(id)) return json({ error: 'id requerido (uuid)' }, 400);
  try {
    const body = await context.request.json();
    const clean = sanitizeEntity(entity, body, true);
    if (!clean.ok) return json({ error: clean.error }, 400);
    const sb = getSupabaseServer();

    if (entity === 'stories') {
      const { data: current, error: fetchErr } = await sb
        .from('contenido_stories')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !current) return json({ error: 'historia no encontrada' }, 404);

      const stageCheck = validateStageChange(current.stage, clean.row);
      if (!stageCheck.ok) return json({ error: stageCheck.error }, 409);

      const sprintChange = typeof clean.row.sprint_id === 'string' && clean.row.sprint_id !== current.sprint_id;
      if (sprintChange) {
        const candidate = { ...current, ...clean.row } as Story;
        const check = await checkWeeklyRule(sb, clean.row.sprint_id as string, candidate);
        if (check) return check;
      }
    }

    const { data, error } = await sb
      .from(ENTITY_TABLE[entity])
      .update(clean.row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Asignar una senal a una historia existente tambien la marca en uso.
    if (entity === 'stories' && typeof clean.row.signal_id === 'string') {
      await markSignalInUse(sb, clean.row.signal_id);
    }

    return json({ row: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const entity = parseEntity(context.params.entity);
  if (!entity) return json({ error: 'entidad desconocida' }, 404);
  const id = context.url.searchParams.get('id');
  if (!isUuid(id)) return json({ error: 'id requerido (uuid)' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from(ENTITY_TABLE[entity]).delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

/** Marca una senal como en uso (best-effort: no bloquea la operacion principal). */
async function markSignalInUse(sb: ReturnType<typeof getSupabaseServer>, signalId: string): Promise<void> {
  await sb
    .from('contenido_signals')
    .update({ status: 'in_use' })
    .eq('id', signalId)
    .in('status', ['new', 'ready'])
    .then(() => undefined, () => undefined);
}

/** Returns a 409 Response when the assignment violates the weekly rule. */
async function checkWeeklyRule(
  sb: ReturnType<typeof getSupabaseServer>,
  sprintId: string,
  candidate: Partial<Story>,
): Promise<Response | null> {
  const { data: sprintStories, error } = await sb
    .from('contenido_stories')
    .select('id, parent_story_id')
    .eq('sprint_id', sprintId);
  if (error) throw error;
  const candidateStory: Story = {
    id: (candidate.id as string) ?? 'candidate',
    parentStoryId: (candidate.parent_story_id as string | null) ?? null,
  } as Story;
  const existing: Story[] = (sprintStories ?? []).map((s) => ({
    id: s.id,
    parentStoryId: s.parent_story_id,
  })) as Story[];
  const validation = validateSprintAssignment(existing, candidateStory);
  if (!validation.ok) {
    return json(
      {
        error: 'regla semanal violada',
        violations: validation.violations,
        parents: validation.parents,
        pieces: validation.pieces,
      },
      409,
    );
  }
  return null;
}
