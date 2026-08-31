// Server route de /api/config/:key: configuracion generica del OS persistida
// en la tabla os_config. Primer uso: `bottom_nav` (que destinos elige Pancho
// para el bottom-nav movil de OSLayout.tsx).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica de negocio vive en src/server/config.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json, origenPermitido } from '../../../server/osAuth.ts';
import { guardarConfig, obtenerConfig } from '../../../server/config.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  const status = msg === 'key invalida' || msg === 'value requerido' ? 400 : 502;
  return json({ error: msg }, status);
}

export const Route = createFileRoute('/api/config/$key')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const config = await obtenerConfig(params.key);
          return json({ config });
        } catch (err) {
          return respuestaError(err);
        }
      },

      PUT: async ({ request, params }) => {
        // Muta estado con la cookie de sesion; misma razon que
        // os-auth/devices/$id.ts para chequear el origen.
        if (!origenPermitido(request)) return json({ error: 'origen no permitido' }, 403);
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as { value?: unknown };
          const config = await guardarConfig(params.key, body.value);
          return json({ ok: true, config });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
