export const prerender = false;

// Promote a Content Radar opportunity to os_contenido_ideas.
// The payload is strictly validated (validatePromotionPayload): the server
// never trusts browser-sent fields. The schema fallback only triggers on real
// "column does not exist" errors; auth/connection/validation errors surface.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../../../lib/supabase';
import { isOsAuthorized, json } from '../../../../../os/lib/osAuth';
import { errMsg } from '../../../../../lib/salud/apiHelpers';
import { validatePromotionPayload } from '../../../../../lib/contenido/radar/promoteValidation.ts';
import type { ContentIdeaInsert } from '../../../../../lib/contenido/radar/types.ts';

const SCHEMA_MIGRATION_WARNING =
  'Radar metadata columns not available; saved base idea only. Run migrations 20260820000000_contenido_radar_fields.sql and 20260821000000_contenido_radar_observed.sql.';

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const validation = validatePromotionPayload(body);
    if (!validation.ok) return json({ error: validation.error }, 400);
    const opp = validation.value;

    const sb = getSupabaseServer();

    const fila: ContentIdeaInsert = {
      titulo: opp.query,
      formato: opp.suggestedFormats[0] ?? null,
      idea_madre: opp.query,
      repurposing: opp.suggestedFormats,
      status: 'idea',
      plataformas: opp.suggestedPlatforms,
      fecha_target: null,
    };

    const metadata: Partial<ContentIdeaInsert> = {
      source_query: opp.query,
      intent: opp.intent,
      opportunity_score: opp.opportunityScore,
      source: opp.source,
      cluster: opp.cluster,
      suggested_formats: opp.suggestedFormats,
      suggested_platforms: opp.suggestedPlatforms,
      observed_sources: opp.observedSources,
      captured_at: opp.capturedAt,
      source_metadata: {
        sources: opp.sources,
        sourceType: opp.sourceType,
        observed: opp.observed,
        generated: opp.generated,
        volume: opp.volume,
        volumeSource: opp.volumeSource,
        volumePeriod: opp.volumePeriod,
        volumeUnit: opp.volumeUnit,
      },
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
        warning = SCHEMA_MIGRATION_WARNING;
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
