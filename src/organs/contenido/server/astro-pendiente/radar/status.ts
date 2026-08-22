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

// GET /api/os/contenido/radar/status
// Sanitized per-source configuration for the UI: which sources are configured,
// which are disabled and why. Never exposes credential values, headers or
// secret-bearing URLs.

import type { APIRoute } from 'astro';
import { isOsAuthorized, json } from '../../../../../os/lib/osAuth';
import { describeSources } from '../../../domain/radar/index.ts';

export const GET: APIRoute = (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  return json({
    sources: describeSources(),
    generatedAt: new Date().toISOString(),
  });
};
