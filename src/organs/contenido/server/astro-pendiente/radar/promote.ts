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

// Promote a Content Radar opportunity to os_contenido_ideas.
// The payload is strictly validated (validatePromotionPayload): the server
// never trusts browser-sent fields. The schema fallback only triggers on real
// "column does not exist" errors; auth/connection/validation errors surface.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../../../lib/supabase';
import { isOsAuthorized, json } from '../../../../../os/lib/osAuth';
import { errMsg } from '../../../../../lib/salud/apiHelpers';
import { validatePromotionPayload } from '../../../domain/radar/promoteValidation.ts';
import type { ContentIdeaInsert } from '../../../domain/radar/types.ts';

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
