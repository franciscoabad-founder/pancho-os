// Server route de /api/revision, portada de src/pages/api/revision.ts (Astro).
//
// Delgada a proposito: auth, lectura del Request y traduccion de errores a
// status HTTP. La logica vive en src/server/revision.handlers.ts.
//
// El contrato HTTP se mantiene identico al de Astro (mismos verbos, mismos
// codigos, mismas claves de respuesta) para que src/os/components/OSRevision.tsx
// siga funcionando con su fetch('/api/revision') sin cambios.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { errMsg } from '../../server/helpers.ts';
import {
  ErrorRevision,
  guardarRevision,
  listarRevisiones,
  obtenerRevision,
} from '../../server/revision.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// ErrorRevision trae su propio status (400). Cualquier otra cosa es un fallo de
// Supabase o de red: 502, con el mismo mensaje que devolvia Astro.
function respuestaError(err: unknown): Response {
  if (err instanceof ErrorRevision) return json({ error: err.message }, err.status);
  return json({ error: errMsg(err) }, 502);
}

export const Route = createFileRoute('/api/revision')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const params = new URL(request.url).searchParams;
          const tipo = params.get('tipo');
          const periodo = params.get('periodo');
          if (periodo) return json({ revision: await obtenerRevision(tipo, periodo) });
          return json({ revisiones: await listarRevisiones(tipo) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      PUT: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as Record<string, unknown>;
          return json({ revision: await guardarRevision(body ?? {}) });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
