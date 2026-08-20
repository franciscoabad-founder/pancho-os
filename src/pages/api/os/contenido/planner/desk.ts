export const prerender = false;

// GET /api/os/contenido/planner/desk
// The weekly Desk: current sprint + capacity (computed from stories, never
// stored), strong unused signals, stories by stage, reuse queue, and the
// weekly rule validation. One round trip for the whole screen.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../../../lib/supabase';
import { isOsAuthorized, json } from '../../../../../os/lib/osAuth';
import { errMsg } from '../../../../../lib/salud/apiHelpers';
import { weekMonday, todayIn } from '../../../../../lib/contenido/planner.ts';
import { capacityRemaining, isLate } from '../../../../../lib/contenido/formulas.ts';
import { validateWeeklyRule } from '../../../../../lib/contenido/weekly.ts';
import { inReuseQueue } from '../../../../../lib/contenido/verdicts.ts';
import type { Story } from '../../../../../lib/contenido/types.ts';

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
