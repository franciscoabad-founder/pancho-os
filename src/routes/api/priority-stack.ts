// Server route de /api/priority-stack, portada de src/pages/api/priority-stack.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica de negocio vive en src/server/priorityStack.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  actualizarPrioridad,
  crearNoHacer,
  crearPrioridad,
  eliminarPriorityStack,
  listarPriorityStack,
} from '../../server/priorityStack.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, 502);
}

const MENSAJES_400 = [
  'no_hacer requerido',
  'titulo requerido',
  'orden debe ser 1, 2 o 3',
  'sin campos para actualizar',
  'id requerido',
  'id o no_hacer_id requerido',
  'Ya existe una prioridad en esa posicion',
];

function es400(err: unknown): boolean {
  return err instanceof Error && MENSAJES_400.includes(err.message);
}

export const Route = createFileRoute('/api/priority-stack')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const semana = new URL(request.url).searchParams.get('semana');
          return json(await listarPriorityStack(semana));
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          if ('no_hacer' in body) {
            const noHacer = await crearNoHacer(body);
            return json({ ok: true, no_hacer: noHacer }, 201);
          }
          const prioridad = await crearPrioridad(body);
          return json({ ok: true, prioridad }, 201);
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
          const prioridad = await actualizarPrioridad(id, body);
          return json({ ok: true, prioridad });
        } catch (err) {
          if (es400(err)) return json({ error: (err as Error).message }, 400);
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        const noHacerId = url.searchParams.get('no_hacer_id');
        if (!id && !noHacerId) return json({ error: 'id o no_hacer_id requerido' }, 400);
        try {
          await eliminarPriorityStack(id, noHacerId);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
