// Server route de /api/bandeja, portada de src/pages/api/bandeja.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica de negocio vive en src/server/bandeja.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  actualizarBandeja,
  crearBandeja,
  eliminarBandeja,
  listarBandeja,
  type ItemBandejaInput,
} from '../../server/bandeja.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, 502);
}

async function leerCuerpo(request: Request): Promise<ItemBandejaInput> {
  const body = await request.json();
  return (body ?? {}) as ItemBandejaInput;
}

const idDeQuery = (request: Request) => new URL(request.url).searchParams.get('id');

export const Route = createFileRoute('/api/bandeja')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const leido = new URL(request.url).searchParams.get('leido');
          return json({ bandeja: await listarBandeja(leido) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const item = await crearBandeja(await leerCuerpo(request));
          return json({ item }, 201);
        } catch (err) {
          if (err instanceof Error && err.message === 'titulo requerido') {
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
          const item = await actualizarBandeja(id, await leerCuerpo(request));
          return json({ item });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarBandeja(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
