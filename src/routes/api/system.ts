// Server route de /api/system, portada de src/pages/api/system.ts (Astro).
//
// Delgada a proposito: auth, lectura del Request y traduccion de errores a
// status HTTP. Las reglas viven en src/server/system.handlers.ts.
//
// Contrato identico al de Astro: el GET responde SIEMPRE 200 (con source
// 'supabase', 'default' o 'fallback'), y el PUT distingue la rama de onboarding
// de la del estado Cortex completo.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  ErrorSystem,
  esPutSoloOnboarding,
  guardarOnboarding,
  guardarSistema,
  obtenerSistema,
} from '../../server/system.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  if (err instanceof ErrorSystem) return json({ error: err.message, ...err.extra }, err.status);
  return json({ error: err instanceof Error ? err.message : String(err) }, 502);
}

export const Route = createFileRoute('/api/system')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return json(await obtenerSistema());
      },

      PUT: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }

        try {
          if (esPutSoloOnboarding(body ?? {})) return json(await guardarOnboarding(body));
          return json(await guardarSistema(body ?? {}));
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
