// Server route de /api/taski/kanban: consulta las tareas y jobs activos de Hermes.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarJobsHermes, taskiConfigurado } from '../../../server/taski.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const sinToken = () => json({ error: 'TASKI_TOKEN no configurado' }, 500);

export const Route = createFileRoute('/api/taski/kanban')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();

        try {
          return json({ tareas: await listarJobsHermes() });
        } catch (err) {
          return json({ error: String(err) }, 500);
        }
      },
    },
  },
});
