// Server route de /api/salud/comidas-log, portada de
// src/pages/api/salud/comidas-log.ts (Astro) a TanStack Start.
//
// El POST aceptaba ademas X-OS-Token (telegram/agente) via
// isExternalTokenAuthorized; el isOsAuthorized de src/server/osAuth.ts ya
// evalua ese mismo header, asi que una sola comprobacion cubre lo mismo.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import {
  actualizarComida,
  eliminarComida,
  leerComidas,
  registrarComida,
} from '../../../server/saludComidasLog.handlers.ts';

export const Route = createFileRoute('/api/salud/comidas-log')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const url = new URL(request.url);
        try {
          return json(await leerComidas({
            historial: url.searchParams.get('historial') === '1',
            desde: url.searchParams.get('desde'),
            dia: url.searchParams.get('dia'),
          }));
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ comida: await registrarComida(await request.json()) }, 201);
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          return json({ comida: await actualizarComida(id, await request.json()) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarComida(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
