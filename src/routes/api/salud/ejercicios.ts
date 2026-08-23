// Server route de /api/salud/ejercicios, portada de
// src/pages/api/salud/ejercicios.ts (Astro) a TanStack Start.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import {
  actualizarEjercicio,
  buscarEjercicios,
  crearEjercicio,
  eliminarEjercicio,
} from '../../../server/saludEjercicios.handlers.ts';

export const Route = createFileRoute('/api/salud/ejercicios')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const url = new URL(request.url);
        try {
          const ejercicios = await buscarEjercicios({
            q: url.searchParams.get('q')?.trim() || null,
            grupo: url.searchParams.get('grupo')?.trim() || null,
            patron: url.searchParams.get('patron')?.trim() || null,
          });
          return json({ ejercicios });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ ejercicio: await crearEjercicio(await request.json()) }, 201);
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          return json({ ejercicio: await actualizarEjercicio(id, await request.json()) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarEjercicio(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
