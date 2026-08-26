import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { obtenerDiagnosticoFinanciero, proponerParaAprobacion } from '../../../server/finanzasAsesor.handlers.ts';

export const Route = createFileRoute('/api/finanzas/asesor')({
  server: { handlers: {
    GET: async ({ request }) => {
      if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
      try { return json(await obtenerDiagnosticoFinanciero()); } catch (error) { return json({ error: error instanceof Error ? error.message : 'Error al analizar finanzas' }, 502); }
    },
    POST: async ({ request }) => {
      if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
      try {
        const body = await request.json() as { propuesta_id?: unknown };
        return json({ aprobacion: await proponerParaAprobacion(body.propuesta_id) }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al crear propuesta';
        return json({ error: message }, message === 'propuesta no disponible' ? 400 : 502);
      }
    },
  } },
});
