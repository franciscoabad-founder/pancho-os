// Server route de /api/habitos/cierre, portada de src/pages/api/habitos/cierre.ts.
//
// El cierre en si vive en src/server/habitos.cierre.handlers.ts porque tambien lo
// llaman GET /api/habitos (fallback lazy) y POST /api/juego/cierre.
//
// Autorizacion: en Astro era cookie O X-OS-Token; el isOsAuthorized de
// src/server/osAuth.ts ya cubre ambos (ver comentario en brief.ts).

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import { cerrarPendientes } from '../../../server/habitos.cierre.handlers.ts';

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

export const Route = createFileRoute('/api/habitos/cierre')({
  server: {
    handlers: {
      // Idempotente: correr dos veces el mismo dia no duplica penalizaciones
      // (habito_cierres.fecha es pk).
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
        try {
          const sb = getSupabaseServer();
          const { cerrados, resumenes } = await cerrarPendientes(sb);
          return json({ ok: true, cerrados, resumenes });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },
    },
  },
});
