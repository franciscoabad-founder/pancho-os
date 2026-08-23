// Server route de /api/brain/proyecto, portada de src/pages/api/brain/proyecto.ts (Astro).
//
// Cambio de auth respecto de Astro: la version vieja comparaba a mano la cookie
// os_auth contra OS_AUTH_TOKEN. Aca se usa isOsAuthorized (superset: cookie,
// token del .env y dispositivo emparejado), igual que el resto de la API.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarProyectoBrain } from '../../../server/brain.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/brain/proyecto')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        const tag = (new URL(request.url).searchParams.get('tag') ?? '').trim().toLowerCase();
        if (!tag) return json({ error: 'tag requerido' }, 400);

        try {
          return json({ tag, paginas: await listarProyectoBrain(tag) });
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
