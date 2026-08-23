// Server route de /api/juego/estado, portada de src/pages/api/juego/estado.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { estadoJuego, actualizarConfigJuego } from '../../../server/juego.estado.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/juego/estado')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return estadoJuego();
      },
      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return actualizarConfigJuego(request);
      },
    },
  },
});
