// Server route de /api/biometricas, portada de src/pages/api/biometricas.ts
// (Astro) a TanStack Start.
//
// El POST aceptaba X-OS-Token (n8n con datos de Google Health); ese header ya
// lo evalua el isOsAuthorized de src/server/osAuth.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../server/saludHttp.ts';
import { guardarBiometricas, leerBiometricas } from '../../server/biometricas.handlers.ts';

export const Route = createFileRoute('/api/biometricas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const { searchParams } = new URL(request.url);
        try {
          return json(await leerBiometricas({
            fecha: searchParams.get('fecha'),
            desde: searchParams.get('desde'),
            hasta: searchParams.get('hasta'),
          }));
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json(await guardarBiometricas(await request.json()));
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
