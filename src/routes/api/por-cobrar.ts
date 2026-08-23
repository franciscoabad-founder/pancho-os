// Server route de /api/por-cobrar, portada de src/pages/api/por-cobrar.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica vive en src/server/porCobrar.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { errMsgCrudo } from '../../server/helpers.ts';
import {
  actualizarPorCobrar,
  crearPorCobrar,
  eliminarPorCobrar,
  listarPorCobrar,
  type PorCobrarInput,
} from '../../server/porCobrar.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const respuestaError = (err: unknown) => json({ error: errMsgCrudo(err) }, 502);
const idDeQuery = (request: Request) => new URL(request.url).searchParams.get('id');

export const Route = createFileRoute('/api/por-cobrar')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ por_cobrar: await listarPorCobrar() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as PorCobrarInput;
          const creado = await crearPorCobrar(body);
          return json({ por_cobrar: creado }, 201);
        } catch (err) {
          if (err instanceof Error && err.message === 'cliente requerido') {
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
          return json({ por_cobrar: await actualizarPorCobrar(id, body) });
        } catch (err) {
          if (err instanceof Error && err.message === 'estado invalido') {
            return json({ error: err.message }, 400);
          }
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarPorCobrar(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
