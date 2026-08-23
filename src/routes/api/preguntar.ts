// Server route de /api/preguntar, portada de src/pages/api/preguntar.ts (Astro).
//
// Auth: isOsAuthorized, o sea cookie de sesion, token del .env
// (Bearer / X-OS-Token) o dispositivo emparejado. La version Astro ya usaba
// isOsAuthorized (sincrona); aca la version es async y hay que esperarla.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { preguntarAlCerebro } from '../../server/preguntar.handlers.ts';

export const Route = createFileRoute('/api/preguntar')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);

        let pregunta: string;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          pregunta = (body.pregunta ?? '').toString().trim();
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }
        if (!pregunta) return json({ error: 'Pregunta requerida' }, 400);

        try {
          return json({ respuesta: await preguntarAlCerebro(pregunta) });
        } catch (err) {
          if (err instanceof Error && err.message === 'N8N_ASSISTANT_URL no configurado') {
            return json({ error: err.message }, 500);
          }
          return json({ error: String(err) }, 502);
        }
      },
    },
  },
});
