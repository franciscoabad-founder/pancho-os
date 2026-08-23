// Server route de /api/salud/rutinas, portada de
// src/pages/api/salud/rutinas.ts (Astro) a TanStack Start.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import {
  actualizarRutina,
  crearRutina,
  eliminarRutina,
  leerRutinas,
} from '../../../server/saludRutinas.handlers.ts';

export const Route = createFileRoute('/api/salud/rutinas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        try {
          return json(await leerRutinas(id));
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ rutina: await crearRutina(await request.json()) }, 201);
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          return json({ rutina: await actualizarRutina(id, await request.json()) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarRutina(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
