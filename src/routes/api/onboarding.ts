// Server route de /api/onboarding, portada de src/pages/api/onboarding.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica de negocio vive en src/server/onboarding.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  aplicarOnboarding,
  guardarOnboarding,
  obtenerOnboarding,
} from '../../server/onboarding.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, 502);
}

const MENSAJES_400 = ['modulo requerido', 'JSON invalido'];

function es400(err: unknown): boolean {
  return err instanceof Error && MENSAJES_400.includes(err.message);
}

export const Route = createFileRoute('/api/onboarding')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const modulo = new URL(request.url).searchParams.get('modulo');
        if (!modulo) return json({ error: 'modulo requerido' }, 400);
        try {
          return json({ estado: await obtenerOnboarding(modulo) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }

        if (body.aplicar === 'salud' || body.aplicar === 'os' || body.aplicar === 'juego') {
          try {
            return json(await aplicarOnboarding(body.aplicar as 'salud' | 'os' | 'juego'));
          } catch (err) {
            return respuestaError(err);
          }
        }

        const modulo = typeof body.modulo === 'string' ? body.modulo.trim() : '';
        if (!modulo) return json({ error: 'modulo requerido' }, 400);

        try {
          const estado = await guardarOnboarding(modulo, body);
          return json({ estado });
        } catch (err) {
          if (es400(err)) return json({ error: (err as Error).message }, 400);
          return respuestaError(err);
        }
      },
    },
  },
});
