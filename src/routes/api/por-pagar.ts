// Server route de /api/por-pagar, espejo de /api/por-cobrar.
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica (y el porque de la tabla nueva) vive en
// src/server/porPagar.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { errMsgCrudo } from '../../server/helpers.ts';
import {
  actualizarPorPagar,
  crearPorPagar,
  eliminarPorPagar,
  listarPorPagar,
  type PorPagarInput,
} from '../../server/porPagar.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const respuestaError = (err: unknown) => json({ error: errMsgCrudo(err) }, 502);
const idDeQuery = (request: Request) => new URL(request.url).searchParams.get('id');

export const Route = createFileRoute('/api/por-pagar')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ por_pagar: await listarPorPagar() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as PorPagarInput;
          const creado = await crearPorPagar(body);
          return json({ por_pagar: creado }, 201);
        } catch (err) {
          if (err instanceof Error && err.message === 'beneficiario requerido') {
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
          return json({ por_pagar: await actualizarPorPagar(id, body) });
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
          await eliminarPorPagar(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
