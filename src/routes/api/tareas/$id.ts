// GET /api/tareas/:id -- CON AUTH. Detalle de una tarea: la fila, sus
// subtareas y su feed (comentarios + cambios + sistema), para el panel de
// detalle (OSTareaDetalle.tsx). Abrir el detalle tambien avanza
// `visto_hasta` (ver obtenerTarea en tareas.handlers.ts).
//
// Solo GET: escribir sigue siendo PATCH /api/tareas?id= (con If-Match) para
// no duplicar el contrato que ya usa OSTareas.tsx.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { ErrorTareas, obtenerTarea } from '../../../server/tareas.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  if (err instanceof ErrorTareas) return json({ error: err.message }, err.status);
  const msg = err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? JSON.stringify(err);
  return json({ error: msg }, 502);
}

export const Route = createFileRoute('/api/tareas/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const tipo = new URL(request.url).searchParams.get('tipo');
          const detalle = await obtenerTarea(params.id, tipo);
          return json(detalle);
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
