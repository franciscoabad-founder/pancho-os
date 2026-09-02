import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { obtenerPrincipios } from '../../server/principios.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, 502);
}

export const Route = createFileRoute('/api/principios')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const principios = await obtenerPrincipios();
          return json({ principios });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
