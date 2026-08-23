// Server route de /api/salud/sueno/cafeina, portada de
// src/pages/api/salud/sueno/cafeina.ts (Astro) a TanStack Start.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../../server/saludHttp.ts';
import {
  eliminarCafeina,
  leerCafeina,
  registrarCafeina,
} from '../../../../server/suenoCafeina.handlers.ts';

export const Route = createFileRoute('/api/salud/sueno/cafeina')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const { searchParams } = new URL(request.url);
        try {
          return json(await leerCafeina({
            desde: searchParams.get('desde'),
            hasta: searchParams.get('hasta'),
            fecha: searchParams.get('fecha'),
          }));
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ dosis: await registrarCafeina(await request.json()) }, 201);
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarCafeina(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
