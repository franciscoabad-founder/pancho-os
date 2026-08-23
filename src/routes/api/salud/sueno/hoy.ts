// Server route de /api/salud/sueno/hoy, portada de
// src/pages/api/salud/sueno/hoy.ts (Astro) a TanStack Start.
//
// Acepta X-OS-Token para que n8n arme el brief de la manana (campo `resumen`);
// ese header ya lo evalua el isOsAuthorized de src/server/osAuth.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../../server/saludHttp.ts';
import { estadoSuenoHoy } from '../../../../server/suenoHoy.handlers.ts';

export const Route = createFileRoute('/api/salud/sueno/hoy')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const fecha = new URL(request.url).searchParams.get('fecha');
        try {
          return json(await estadoSuenoHoy(fecha));
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
