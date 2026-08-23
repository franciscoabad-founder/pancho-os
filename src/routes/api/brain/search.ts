// Server route de /api/brain/search, portada de src/pages/api/brain/search.ts (Astro).
//
// Cambio de auth respecto de Astro: la version vieja comparaba a mano la cookie
// os_auth contra OS_AUTH_TOKEN. Aca se usa isOsAuthorized (superset: cookie,
// token del .env y dispositivo emparejado), igual que el resto de la API.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { buscarEnBrain } from '../../../server/brain.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/brain/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        // Sin query devolvemos 200 con lista vacia, igual que la version Astro:
        // la caja de busqueda de /cerebro dispara en cada tecla.
        const q = new URL(request.url).searchParams.get('q')?.trim();
        if (!q) return json({ results: [] });

        try {
          return json({ results: await buscarEnBrain(q) });
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
