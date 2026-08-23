// Server route de /api/capturar, portada de src/pages/api/capturar.ts (Astro).
//
// Auth: isOsAuthorized, o sea cookie de sesion, token del .env
// (Bearer / X-OS-Token) o dispositivo emparejado. La version Astro ya habia
// unificado este endpoint al mismo chequeo que el resto de la API; aca solo
// cambia que la funcion es async y hay que esperarla.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { capturarTexto } from '../../server/capturar.handlers.ts';

export const Route = createFileRoute('/api/capturar')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);

        let texto: string;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          texto = (body.texto ?? '').toString().trim();
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }
        if (!texto) return json({ error: 'Texto requerido' }, 400);

        try {
          await capturarTexto(texto);
          return json({ ok: true });
        } catch (err) {
          if (err instanceof Error && err.message === 'CAPTURE_WEBHOOK_URL no configurado') {
            return json({ error: err.message }, 500);
          }
          return json({ error: String(err) }, 502);
        }
      },
    },
  },
});
