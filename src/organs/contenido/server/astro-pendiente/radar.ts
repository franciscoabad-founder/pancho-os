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

// Content Radar API: run the radar pipeline.
// GET  /api/os/contenido/radar/status -> sanitized per-source configuration.
// POST /api/os/contenido/radar/promote -> promotion to os_contenido_ideas (./promote.ts).

import type { APIRoute } from 'astro';
import { isOsAuthorized, json } from '../../../../os/lib/osAuth';
import { errMsg } from '../../../../lib/salud/apiHelpers';
import { runRadar, SOURCE_KINDS } from '../../domain/radar/index.ts';
import type { SourceKind } from '../../domain/radar/types.ts';

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
