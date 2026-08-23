// Server route de /api/redes-metricas, portada de src/pages/api/redes-metricas.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica vive en src/server/redesMetricas.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { errMsgCrudo } from '../../server/helpers.ts';
import { guardarMetrica, resumenRedes } from '../../server/redesMetricas.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const respuestaError = (err: unknown) => json({ error: errMsgCrudo(err) }, 502);

export const Route = createFileRoute('/api/redes-metricas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const dias = new URL(request.url).searchParams.get('dias');
          return json(await resumenRedes(dias));
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const { metrica, posts } = await guardarMetrica(body);
          return json({ metrica, posts }, 201);
        } catch (err) {
          if (err instanceof Error && (err.message.startsWith('plataforma debe ser una de:') || err.message === 'fecha requerida')) {
            return json({ error: err.message }, 400);
          }
          return respuestaError(err);
        }
      },
    },
  },
});
