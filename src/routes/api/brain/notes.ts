// Server route de /api/brain/notes, portada de src/pages/api/brain/notes.ts (Astro).
//
// Delgada a proposito: auth, parseo de query params y traduccion de errores a
// status HTTP. La logica de negocio vive en src/server/brain.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarNotasBrain } from '../../../server/brain.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, 502);
}

export const Route = createFileRoute('/api/brain/notes')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const url = new URL(request.url);
          const resultado = await listarNotasBrain(
            url.searchParams.get('limit'),
            url.searchParams.get('page'),
            url.searchParams.get('tag'),
          );
          return json(resultado);
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
