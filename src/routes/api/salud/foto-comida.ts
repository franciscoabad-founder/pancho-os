// Server route de /api/salud/foto-comida, portada de
// src/pages/api/salud/foto-comida.ts (Astro) a TanStack Start.
//
// Unico endpoint de Salud donde un JSON invalido responde 400 y no 502: el
// original parseaba el body en su propio try/catch antes del bloque principal.
// Se conserva tal cual.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import { estimarFotoComida } from '../../../server/saludFotoComida.handlers.ts';

export const Route = createFileRoute('/api/salud/foto-comida')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'JSON inválido' }, 400);
        }

        try {
          return json({ estimacion: await estimarFotoComida(body) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
