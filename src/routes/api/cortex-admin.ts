// Server route de /api/cortex-admin, portada de src/pages/api/cortex-admin.ts (Astro).
//
// Delgada a proposito: auth y traduccion de errores. El proxy vive en
// src/server/cortex.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { obtenerOverviewCortex } from '../../server/cortex.handlers.ts';

export const Route = createFileRoute('/api/cortex-admin')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);

        try {
          const { data, status } = await obtenerOverviewCortex();
          return json(data, status);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg === 'CORTEX_ADMIN_TOKEN no configurado') return json({ error: msg }, 500);
          return json({ error: `Error al conectar con Cortex: ${msg}` }, 502);
        }
      },
    },
  },
});
