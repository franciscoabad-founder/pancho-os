export const prerender = false;

// Content Radar API: run the radar pipeline.
// Promotion to os_contenido_ideas lives in ./promote.ts (POST /api/os/contenido/radar/promote).

import type { APIRoute } from 'astro';
import { isOsAuthorized, json } from '../../../../os/lib/osAuth';
import { errMsg } from '../../../../lib/salud/apiHelpers';
import { runRadar } from '../../../../lib/contenido/radar/index.ts';

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const seed = typeof body.seed === 'string' ? body.seed.trim() : '';
    if (!seed) return json({ error: 'seed requerido' }, 400);

    const result = await runRadar({
      seed,
      lang: typeof body.lang === 'string' ? body.lang : 'es',
      country: typeof body.country === 'string' ? body.country : 'Ecuador',
      sources: Array.isArray(body.sources) ? body.sources : undefined,
    });

    return json(result);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
