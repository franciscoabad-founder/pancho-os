// POST /api/journal/brain-sync {fecha}: compone las entradas del dia en una
// pagina markdown y la escribe en gbrain (slug diario-YYYY-MM-DD).

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { sincronizarDiaAlBrain } from '../../../server/journal.brain.handlers.ts';

const ES_400 = /requerido|invalid|no hay entradas/i;

export const Route = createFileRoute('/api/journal/brain-sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
        try {
          const body = (await request.json().catch(() => ({}))) as { fecha?: unknown };
          const resultado = await sincronizarDiaAlBrain(body.fecha);
          return json({ ok: true, ...resultado });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'error desconocido';
          return json({ error: msg }, ES_400.test(msg) ? 400 : 502);
        }
      },
    },
  },
});
