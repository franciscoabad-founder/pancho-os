// Server route de /api/salud/config, portada de src/pages/api/salud/config.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import { actualizarConfig, getConfig } from '../../../server/saludConfig.handlers.ts';

export const Route = createFileRoute('/api/salud/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ config: await getConfig() });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ config: await actualizarConfig(await request.json()) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
