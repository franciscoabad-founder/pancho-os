// Server route de /api/lineas, portada de src/pages/api/lineas.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica de negocio vive en src/server/lineas.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  actualizarLinea,
  crearLinea,
  eliminarLinea,
  listarLineas,
} from '../../server/lineas.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, 502);
}

const MENSAJES_400 = [
  'nombre requerido',
  'prioridad_stack debe estar entre 0 y 4',
  'estado invalido',
  'sin campos para actualizar',
  'id requerido',
  'Ya existe una linea con ese nombre',
];

function es400(err: unknown): boolean {
  return err instanceof Error && MENSAJES_400.includes(err.message);
}

export const Route = createFileRoute('/api/lineas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const soloMaker = new URL(request.url).searchParams.get('maker') === '1';
          return json({ lineas: await listarLineas(soloMaker) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const linea = await crearLinea(body);
          return json({ ok: true, linea }, 201);
        } catch (err) {
          if (es400(err)) return json({ error: (err as Error).message }, 400);
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const linea = await actualizarLinea(id, body);
          return json({ ok: true, linea });
        } catch (err) {
          if (es400(err)) return json({ error: (err as Error).message }, 400);
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarLinea(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
