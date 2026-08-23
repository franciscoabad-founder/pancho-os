// Server route de /api/salud/sesiones, portada de
// src/pages/api/salud/sesiones.ts (Astro) a TanStack Start.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import {
  actualizarSesion,
  crearSesion,
  eliminarSesion,
  leerSesiones,
} from '../../../server/saludSesiones.handlers.ts';

export const Route = createFileRoute('/api/salud/sesiones')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const url = new URL(request.url);
        try {
          return json(await leerSesiones({
            id: url.searchParams.get('id'),
            limitParam: url.searchParams.get('limit'),
          }));
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ sesion: await crearSesion(await request.json()) }, 201);
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          return json({ sesion: await actualizarSesion(id, await request.json()) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarSesion(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
