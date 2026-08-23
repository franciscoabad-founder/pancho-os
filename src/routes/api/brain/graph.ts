// Server route de /api/brain/graph, portada de src/pages/api/brain/graph.ts (Astro).
//
// Delgada a proposito: auth, parseo de query params y traduccion de errores a
// status HTTP. La logica vive en src/server/brainGraph.handlers.ts.
//
// Cambio de auth respecto de Astro: la version vieja comparaba a mano la cookie
// os_auth contra OS_AUTH_TOKEN. Aca se usa isOsAuthorized, que es un superset
// (cookie, token del .env y dispositivo emparejado), igual que el resto de la
// API ya portada.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { obtenerGrafoBrain } from '../../../server/brainGraph.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/brain/graph')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        const wantAll = new URL(request.url).searchParams.get('all') === '1';
        try {
          return json(await obtenerGrafoBrain(wantAll));
        } catch (err) {
          if (err instanceof Error && err.message === 'GBRAIN_TOKEN not configured') {
            return json({ error: err.message }, 500);
          }
          return json({ error: String(err) }, 502);
        }
      },
    },
  },
});
