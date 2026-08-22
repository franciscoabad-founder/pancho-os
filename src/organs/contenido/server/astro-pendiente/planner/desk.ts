// PENDIENTE DE PORTAR A TANSTACK START.
//
// Este endpoint se movio al organo con `git mv` tal cual: cero cambios de
// logica, solo se ajustaron las rutas relativas de sus imports. Sigue escrito
// para Astro (`APIRoute`, `isOsAuthorized(context)`, `context.url`), asi que
// hoy NO esta montado: el router de TanStack Start solo descubre rutas bajo
// src/routes/**, y en esta rama Astro ni siquiera esta instalado.
//
// Por que no se porto ahora: el plan (Fase 1, regla de tres cubetas) manda a
// portar cada endpoint DURANTE la migracion de su pantalla, porque el archivo
// se reescribe linea por linea de todos modos y hacerlo dos veces es trabajo
// perdido. Las pantallas /os/contenido/radar y /os/contenido/planner todavia
// no se portaron. Se porta cuando les toque, siguiendo el patron de
// src/organs/contenido/server/ideas.handlers.ts + src/routes/api/contenido.ts:
// logica pura en el organo, server route delgada en src/routes/api/**.
//
// La excepcion de esta tanda es el pipeline de ideas (os_contenido_ideas), que
// SI se porto porque el editor de borradores lo necesitaba vivo para dejar de
// perder lo escrito al refrescar.

export const prerender = false;

// GET /api/os/contenido/planner/desk
// The weekly Desk: current sprint + capacity (computed from stories, never
// stored), strong unused signals, stories by stage, reuse queue, and the
// weekly rule validation. One round trip for the whole screen.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../../../lib/supabase';
import { isOsAuthorized, json } from '../../../../../os/lib/osAuth';
import { errMsg } from '../../../../../lib/salud/apiHelpers';
import { weekMonday, todayIn } from '../../../domain/planner.ts';
import { capacityRemaining, isLate } from '../../../domain/formulas.ts';
import { validateWeeklyRule } from '../../../domain/weekly.ts';
import { inReuseQueue } from '../../../domain/verdicts.ts';
import type { Story } from '../../../domain/types.ts';

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const monday = weekMonday(new Date());

    const { data: sprints, error: sprintErr } = await sb
      .from('contenido_weekly_sprints')
      .select('*')
      .eq('week_of', monday)
      .order('created_at', { ascending: false })
      .limit(1);
    if (sprintErr) throw sprintErr;
    const sprint = sprints?.[0] ?? null;

    let stories: Record<string, unknown>[] = [];
    if (sprint) {
      const { data, error } = await sb
        .from('contenido_stories')
        .select('*')
        .eq('sprint_id', sprint.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      stories = data ?? [];
    }

    const { data: signals, error: sigErr } = await sb
      .from('contenido_signals')
      .select('*')
      .gte('strength', 4)
      .in('status', ['new', 'ready'])
      .order('strength', { ascending: false })
      .order('captured_on', { ascending: false })
      .limit(10);
    if (sigErr) throw sigErr;

    const { data: results, error: resErr } = await sb
      .from('contenido_results')
      .select('*')
      .or('verdict.eq.reuse,repurpose_queue.not.is.null')
      .order('created_at', { ascending: false })
      .limit(20);
    if (resErr) throw resErr;

    const reuseQueue = (results ?? []).filter((r) =>
      inReuseQueue({ verdict: r.verdict, repurposeQueue: r.repurpose_queue }),
    );

    const domainStories = stories.map((s) => ({
      id: s.id as string,
      parentStoryId: (s.parent_story_id as string | null) ?? null,
    })) as Story[];
    const weeklyValidation = validateWeeklyRule(domainStories);

    const capacity = (sprint?.capacity as number | undefined) ?? 0;
    const plannedPieces = stories.length;
    const today = todayIn();

    return json({
      weekOf: monday,
      sprint,
      stories,
      weeklyValidation,
      capacity,
      plannedPieces,
      capacityRemaining: capacityRemaining(capacity, plannedPieces),
      lateStoryIds: stories
        .filter((s) => isLate(s.publish_date as string | null, s.stage as Story['stage'], today))
        .map((s) => s.id),
      strongSignals: signals ?? [],
      reuseQueue,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
