export const prerender = false;

// Promote a Content Radar opportunity to os_contenido_ideas.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../../../lib/supabase';
import { isOsAuthorized, json } from '../../../../../os/lib/osAuth';
import { errMsg } from '../../../../../lib/salud/apiHelpers';
import type { RadarOpportunity, ContentIdeaInsert } from '../../../../../lib/contenido/radar/types.ts';

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const opp = body.opportunity as RadarOpportunity | undefined;
    if (!opp || !opp.query) return json({ error: 'opportunity requerida' }, 400);

    const sb = getSupabaseServer();

    const fila: ContentIdeaInsert = {
      titulo: opp.query,
      formato: opp.suggestedFormats?.[0] ?? null,
      idea_madre: opp.query,
      repurposing: opp.suggestedFormats ?? [],
      status: 'idea',
      plataformas: opp.suggestedPlatforms ?? [],
      fecha_target: null,
    };

    const metadata: Partial<ContentIdeaInsert> = {
      source_query: opp.query,
      intent: opp.intent,
      opportunity_score: opp.opportunityScore,
      source: opp.source,
      cluster: opp.cluster,
      suggested_formats: opp.suggestedFormats ?? [],
      suggested_platforms: opp.suggestedPlatforms ?? [],
    };

    let data;
    let warning: string | undefined;
    try {
      const res = await sb.from('os_contenido_ideas').insert([{ ...fila, ...metadata }]).select().single();
      if (res.error) throw res.error;
      data = res.data;
    } catch (err) {
      const msg = errMsg(err);
      if (/column .* does not exist/i.test(msg) || /could not find .* in the schema/i.test(msg)) {
        warning = 'Radar metadata columns not available; saved base idea only. Run migration 20260820000000_contenido_radar_fields.sql.';
        const res = await sb.from('os_contenido_ideas').insert([fila]).select().single();
        if (res.error) throw res.error;
        data = res.data;
      } else {
        throw err;
      }
    }

    return json({ idea: data, warning }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
