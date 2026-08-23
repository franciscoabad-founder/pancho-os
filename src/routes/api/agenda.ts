// Server route de agenda, portado de src/pages/api/agenda.ts (Astro).
// Mantiene el mismo contrato HTTP para que el componente React pueda usar
// fetch('/api/agenda') igual que la version Astro.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  ErrorAgenda,
  actualizarEvento,
  crearEvento,
  eliminarEvento,
  listarEventos,
  type CuerpoEvento,
} from '../../server/agenda.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  if (err instanceof ErrorAgenda) return json({ error: err.message }, err.status);
  const msg = err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? JSON.stringify(err);
  return json({ error: msg }, 502);
}

async function leerCuerpo(request: Request): Promise<CuerpoEvento> {
  const body = await request.json();
  return (body ?? {}) as CuerpoEvento;
}

export const Route = createFileRoute('/api/agenda')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const url = new URL(request.url);
          const eventos = await listarEventos(
            url.searchParams.get('desde'),
            url.searchParams.get('hasta'),
          );
          return json({ eventos });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const evento = await crearEvento(await leerCuerpo(request));
          return json({ ok: true, evento }, 201);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const id = new URL(request.url).searchParams.get('id');
          const evento = await actualizarEvento(id, await leerCuerpo(request));
          return json({ ok: true, evento });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const id = new URL(request.url).searchParams.get('id');
          await eliminarEvento(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
