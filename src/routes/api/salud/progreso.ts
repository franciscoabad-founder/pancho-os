// Server route de /api/salud/progreso, portada de
// src/pages/api/salud/progreso.ts (Astro) a TanStack Start.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import { leerProgreso } from '../../../server/saludProgreso.handlers.ts';

export const Route = createFileRoute('/api/salud/progreso')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const dias = Number(new URL(request.url).searchParams.get('dias'));
        try {
          return json(await leerProgreso(dias));
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
