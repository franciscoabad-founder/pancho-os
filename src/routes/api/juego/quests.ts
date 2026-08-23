// Server route de /api/juego/quests, portada de src/pages/api/juego/quests.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarQuests, crearQuest, cancelarQuest } from '../../../server/juego.quests.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/juego/quests')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return listarQuests();
      },
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return crearQuest(request);
      },
      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return cancelarQuest(request);
      },
    },
  },
});
