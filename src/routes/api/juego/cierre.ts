// Server route de /api/juego/cierre, portada de src/pages/api/juego/cierre.ts.
//
// Autorizacion: en Astro era cookie O X-OS-Token (n8n a las 00:05 Guayaquil); el
// isOsAuthorized de src/server/osAuth.ts ya cubre ambos caminos.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { cierreJuego } from '../../../server/juego.cierre.handlers.ts';

export const Route = createFileRoute('/api/juego/cierre')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
        return cierreJuego();
      },
    },
  },
});
