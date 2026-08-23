// Server route de /api/brain/note, portada de src/pages/api/brain/note.ts (Astro).
//
// Cambio de auth respecto de Astro: la version vieja comparaba a mano la cookie
// os_auth contra OS_AUTH_TOKEN. Aca se usa isOsAuthorized (superset: cookie,
// token del .env y dispositivo emparejado), igual que el resto de la API.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { obtenerNotaBrain } from '../../../server/brain.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/brain/note')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        const slug = new URL(request.url).searchParams.get('slug')?.trim();
        if (!slug) return json({ error: 'slug requerido' }, 400);

        try {
          return json(await obtenerNotaBrain(slug));
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
