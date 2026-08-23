// Server route de /api/juego/recompensas, portada de
// src/pages/api/juego/recompensas.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import {
  listarRecompensas,
  crearOCanjearRecompensa,
  actualizarRecompensa,
} from '../../../server/juego.recompensas.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/juego/recompensas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return listarRecompensas();
      },
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return crearOCanjearRecompensa(request);
      },
      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return actualizarRecompensa(request);
      },
    },
  },
});
