// GET /api/os/contenido/planner/desk, portado de
// src/organs/contenido/server/astro-pendiente/planner/desk.ts (Astro) a
// TanStack Start.
//
// El Desk semanal: sprint actual + capacidad (calculada de las historias,
// nunca guardada), senales fuertes sin usar, historias por etapa, cola de
// reuso y la validacion de la regla semanal. Un solo viaje para toda la
// pantalla.
//
// Mismo molde que src/routes/api/contenido.ts: auth + IO aca, reglas de
// negocio puras en el organo (src/organs/contenido/domain/**).

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../../../server/supabase.ts';
import { errMsg } from '../../../../../lib/salud/apiHelpers.ts';
import { weekMonday, todayIn } from '../../../../../organs/contenido/domain/planner.ts';
import { capacityRemaining, isLate } from '../../../../../organs/contenido/domain/formulas.ts';
import { validateWeeklyRule } from '../../../../../organs/contenido/domain/weekly.ts';
import { inReuseQueue } from '../../../../../organs/contenido/domain/verdicts.ts';
import type { Story } from '../../../../../organs/contenido/domain/types.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/os/contenido/planner/desk')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
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
      },
    },
  },
});
