// Server route de /api/taski/sesiones: lista las conversaciones de Hermes que
// se pueden elegir desde Taski (la propia del OS + las de Telegram). Ver
// listarSesionesTaski() en src/server/taski.handlers.ts para el proxy.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarSesionesTaski, taskiConfigurado } from '../../../server/taski.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const sinToken = () => json({ error: 'TASKI_TOKEN no configurado' }, 500);

// Mismo criterio que taski.ts: un abort del AbortController llega como
// AbortError, se traduce a un mensaje util en vez del stack crudo.
function errorHermes(err: unknown): Response {
  const abort = err instanceof Error && err.name === 'AbortError';
  return json({ error: abort ? 'Hermes tardo demasiado en responder' : String(err) }, 502);
}

export const Route = createFileRoute('/api/taski/sesiones')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();

        try {
          return json({ sesiones: await listarSesionesTaski() });
        } catch (err) {
          return errorHermes(err);
        }
      },
    },
  },
});
