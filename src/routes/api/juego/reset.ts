// Server route de /api/juego/reset: accion destructiva del modulo Juego.
// El confirm vive en el front (OSJuego.tsx); aqui solo auth + delegacion.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { resetJuego } from '../../../server/juego.reset.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/juego/reset')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return resetJuego();
      },
    },
  },
});
