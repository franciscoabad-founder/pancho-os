// Server route de /api/gastos, portada de src/pages/api/gastos.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica vive en src/server/gastos.handlers.ts.
//
// La forma de las respuestas es literal a la version Astro porque el MCP
// (finanzas_log_gasto, finanzas_listar_gastos) consume este endpoint.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { errMsgCrudo } from '../../server/helpers.ts';
import {
  actualizarGasto,
  crearGasto,
  eliminarGasto,
  listarGastos,
  type GastoInput,
} from '../../server/gastos.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const respuestaError = (err: unknown) => json({ error: errMsgCrudo(err) }, 502);
const idDeQuery = (request: Request) => new URL(request.url).searchParams.get('id');

export const Route = createFileRoute('/api/gastos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ gastos: await listarGastos() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as GastoInput;
          const gasto = await crearGasto(body);
          return json({ gasto }, 201);
        } catch (err) {
          if (err instanceof Error && err.message === 'descripcion o monto requerido') {
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
          return json({ gasto: await actualizarGasto(id, body) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarGasto(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
