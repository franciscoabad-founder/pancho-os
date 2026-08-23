// Server route de /api/salud/ayunos, portada de src/pages/api/salud/ayunos.ts.
//
// Nota de auth: el original pedia `isOsAuthorized(context) ||
// isExternalTokenAuthorized(context)` en POST y PATCH, porque el isOsAuthorized
// de Astro solo miraba la cookie y el segundo helper cubria X-OS-Token. El
// isOsAuthorized de src/server/osAuth.ts ya evalua cookie, Bearer y X-OS-Token
// contra OS_API_TOKEN/OS_API_TOKENS, asi que una sola llamada cubre exactamente
// el mismo conjunto de clientes (UI, agente, telegram).

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import {
  actualizarAyuno,
  eliminarAyuno,
  iniciarAyuno,
  leerAyunos,
} from '../../../server/saludAyunos.handlers.ts';

export const Route = createFileRoute('/api/salud/ayunos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const abierto = new URL(request.url).searchParams.get('abierto') === '1';
        try {
          return json(await leerAyunos(abierto));
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ ayuno: await iniciarAyuno(await request.json()) }, 201);
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        try {
          return json({ ayuno: await actualizarAyuno(id, await request.json()) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarAyuno(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
