// Server route de /api/objetivos, portada de src/pages/api/objetivos.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica de negocio vive en src/server/objetivos.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  actualizarObjetivo,
  crearObjetivo,
  eliminarObjetivo,
  listarObjetivos,
} from '../../server/objetivos.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, 502);
}

const MENSAJES_400 = [
  'titulo requerido',
  'orden debe ser 1, 2 o 3',
  'sin campos para actualizar',
  'id requerido',
  'Ya existe un objetivo activo en esa posicion',
];

function es400(err: unknown): boolean {
  return err instanceof Error && MENSAJES_400.includes(err.message);
}

export const Route = createFileRoute('/api/objetivos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const todos = new URL(request.url).searchParams.get('todos') === '1';
          return json({ objetivos: await listarObjetivos(todos) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const objetivo = await crearObjetivo(body);
          return json({ ok: true, objetivo }, 201);
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
          const objetivo = await actualizarObjetivo(id, body);
          return json({ ok: true, objetivo });
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
          await eliminarObjetivo(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
