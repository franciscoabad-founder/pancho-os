// Server route de /api/cortex-invitar, portada de src/pages/api/cortex-invitar.ts (Astro).
//
// Delgada a proposito: auth, parseo del cuerpo y traduccion de errores. La
// validacion y el proxy viven en src/server/cortex.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { invitarTesterCortex, validarInvitacion } from '../../server/cortex.handlers.ts';

// Errores de validacion del cuerpo: 400. Cualquier otro fallo es de conexion.
const ERRORES_400 = new Set(['nombre requerido', 'email requerido', 'consentimiento_datos requerido']);

export const Route = createFileRoute('/api/cortex-invitar')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }

        try {
          const { data, status } = await invitarTesterCortex(validarInvitacion(body));
          return json(data, status);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (ERRORES_400.has(msg)) return json({ error: msg }, 400);
          if (msg === 'CORTEX_ADMIN_TOKEN no configurado') return json({ error: msg }, 500);
          return json({ error: `Error al conectar con Cortex: ${msg}` }, 502);
        }
      },
    },
  },
});
