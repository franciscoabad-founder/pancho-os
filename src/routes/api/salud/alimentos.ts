// Server route de /api/salud/alimentos, portada de
// src/pages/api/salud/alimentos.ts (Astro) a TanStack Start.
//
// Delgada a proposito: auth, lectura de query/body y traduccion de errores a
// status HTTP. La logica vive en src/server/saludAlimentos.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import {
  actualizarAlimento,
  buscarAlimentos,
  crearAlimento,
  eliminarAlimento,
} from '../../../server/saludAlimentos.handlers.ts';

export const Route = createFileRoute('/api/salud/alimentos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const url = new URL(request.url);
        try {
          return json(await buscarAlimentos({
            q: url.searchParams.get('q')?.trim() || '',
            barcode: url.searchParams.get('barcode')?.trim() || '',
            modo: url.searchParams.get('modo')?.trim() || '',
          }));
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ alimento: await crearAlimento(await request.json()) }, 201);
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          return json({ alimento: await actualizarAlimento(id, await request.json()) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarAlimento(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
