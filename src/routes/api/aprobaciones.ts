// Server route de /api/aprobaciones, portada de src/pages/api/aprobaciones.ts
// (Astro).
//
// Delgada a proposito: auth, lectura del Request y traduccion de errores a
// status HTTP. Las reglas viven en src/server/aprobaciones.handlers.ts.
//
// El contrato HTTP se mantiene identico al de Astro porque lo consumen dos
// clientes: src/os/components/OSAprobaciones.tsx y las tools MCP
// aprobaciones_listar / aprobaciones_solicitar (src/mcp/osTools.ts).
//
// Detalle heredado de Astro que se conserva a proposito: en PATCH y DELETE el
// chequeo de `id` va ANTES del try, asi que un id ausente devuelve 400 sin
// pasar por el 502 generico.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { errMsg } from '../../server/helpers.ts';
import {
  ErrorAprobaciones,
  actualizarAprobacion,
  crearAprobacion,
  eliminarAprobacion,
  listarAprobaciones,
} from '../../server/aprobaciones.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  if (err instanceof ErrorAprobaciones) return json({ error: err.message }, err.status);
  return json({ error: errMsg(err) }, 502);
}

export const Route = createFileRoute('/api/aprobaciones')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const estado = new URL(request.url).searchParams.get('estado');
          return json({ aprobaciones: await listarAprobaciones(estado) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as Record<string, unknown>;
          return json({ aprobacion: await crearAprobacion(body ?? {}) }, 201);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const body = (await request.json()) as Record<string, unknown>;
          return json({ aprobacion: await actualizarAprobacion(id, body ?? {}) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarAprobacion(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
