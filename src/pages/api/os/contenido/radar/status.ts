export const prerender = false;

// GET /api/os/contenido/radar/status
// Sanitized per-source configuration for the UI: which sources are configured,
// which are disabled and why. Never exposes credential values, headers or
// secret-bearing URLs.

import type { APIRoute } from 'astro';
import { isOsAuthorized, json } from '../../../../../os/lib/osAuth';
import { describeSources } from '../../../../../lib/contenido/radar/index.ts';

export const GET: APIRoute = (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  return json({
    sources: describeSources(),
    generatedAt: new Date().toISOString(),
  });
};
