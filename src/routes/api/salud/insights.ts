// Server route de /api/salud/insights, portada de
// src/pages/api/salud/insights.ts (Astro) a TanStack Start.
//
// Autorizado por cookie de sesion o X-OS-Token (n8n/cron): las dos las cubre
// el isOsAuthorized de src/server/osAuth.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import { generarInsights } from '../../../server/saludInsights.handlers.ts';

export const Route = createFileRoute('/api/salud/insights')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json(await generarInsights());
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
