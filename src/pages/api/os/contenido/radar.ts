export const prerender = false;

// Content Radar API: run the radar pipeline.
// GET  /api/os/contenido/radar/status -> sanitized per-source configuration.
// POST /api/os/contenido/radar/promote -> promotion to os_contenido_ideas (./promote.ts).

import type { APIRoute } from 'astro';
import { isOsAuthorized, json } from '../../../../os/lib/osAuth';
import { errMsg } from '../../../../lib/salud/apiHelpers';
import { runRadar, SOURCE_KINDS } from '../../../../lib/contenido/radar/index.ts';
import type { SourceKind } from '../../../../lib/contenido/radar/types.ts';

const MAX_SEED_LENGTH = 120;
const MAX_LANG_LENGTH = 10;
const MAX_COUNTRY_LENGTH = 60;

function boundedString(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : undefined;
}

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const seed = boundedString(body?.seed, MAX_SEED_LENGTH) ?? '';
    if (typeof body?.seed === 'string' && body.seed.trim().length > MAX_SEED_LENGTH) {
      return json({ error: `seed demasiado largo (max ${MAX_SEED_LENGTH} caracteres)` }, 400);
    }
    if (!seed) return json({ error: 'seed requerido' }, 400);

    let sources: SourceKind[] | undefined;
    if (Array.isArray(body.sources)) {
      sources = body.sources.filter(
        (s: unknown): s is SourceKind =>
          typeof s === 'string' && (SOURCE_KINDS as readonly string[]).includes(s),
      );
      if (sources.length === 0) sources = undefined;
    }

    const result = await runRadar({
      seed,
      lang: boundedString(body.lang, MAX_LANG_LENGTH) ?? 'es',
      country: boundedString(body.country, MAX_COUNTRY_LENGTH) ?? 'Ecuador',
      sources,
      options: { timeoutMs: body?.options?.timeoutMs },
    });

    return json(result);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
