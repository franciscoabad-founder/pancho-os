// Server route de /api/taski/modelos: lista los modelos disponibles en Hermes
// y permite cambiar el modelo asignado a una sesion o de forma global.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { cambiarModeloHermes, listarModelosHermes, SESSION_ID, taskiConfigurado } from '../../../server/taski.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const sinToken = () => json({ error: 'TASKI_TOKEN no configurado' }, 500);

function errorHermes(err: unknown): Response {
  const abort = err instanceof Error && err.name === 'AbortError';
  return json({ error: abort ? 'Hermes tardo demasiado en responder' : String(err) }, 502);
}

export const Route = createFileRoute('/api/taski/modelos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();

        try {
          return json({ modelos: await listarModelosHermes() });
        } catch (err) {
          return errorHermes(err);
        }
      },
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();

        let model: string;
        let sessionId: string;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          model = (body.model ?? '').toString().trim();
          sessionId = (body.session_id ?? '').toString().trim() || SESSION_ID;
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }

        if (!model) {
          return json({ error: 'El campo model es requerido' }, 400);
        }

        try {
          const result = await cambiarModeloHermes(model, sessionId);
          return json(result);
        } catch (err) {
          return errorHermes(err);
        }
      },
    },
  },
});
