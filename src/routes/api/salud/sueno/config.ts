// Server route de /api/salud/sueno/config, portada de
// src/pages/api/salud/sueno/config.ts (Astro) a TanStack Start.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../../server/saludHttp.ts';
import { actualizarConfigSueno, leerConfigSueno } from '../../../../server/suenoConfig.handlers.ts';

export const Route = createFileRoute('/api/salud/sueno/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ config: await leerConfigSueno() });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ config: await actualizarConfigSueno(await request.json()) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
