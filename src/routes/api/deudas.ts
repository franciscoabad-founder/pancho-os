// Server route de /api/deudas, portada de src/pages/api/deudas.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica vive en src/server/deudas.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { errMsgCrudo } from '../../server/helpers.ts';
import {
  actualizarDeuda,
  crearDeuda,
  eliminarDeuda,
  listarDeudas,
  type DeudaInput,
} from '../../server/deudas.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const respuestaError = (err: unknown) => json({ error: errMsgCrudo(err) }, 502);
const idDeQuery = (request: Request) => new URL(request.url).searchParams.get('id');

export const Route = createFileRoute('/api/deudas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ deudas: await listarDeudas() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as DeudaInput;
          const deuda = await crearDeuda(body);
          return json({ deuda }, 201);
        } catch (err) {
          if (err instanceof Error && err.message === 'acreedor requerido') {
            return json({ error: err.message }, 400);
          }
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const body = (await request.json()) as Record<string, unknown>;
          return json({ deuda: await actualizarDeuda(id, body) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarDeuda(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
