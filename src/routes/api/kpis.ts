// Server route de /api/kpis, portada de src/pages/api/kpis.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica vive en src/server/kpis.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { errMsg, pgCode } from '../../server/helpers.ts';
import {
  actualizarKpi,
  crearKpi,
  eliminarKpi,
  listarKpis,
  listarSerie,
  registrarValorKpi,
} from '../../server/kpis.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const respuestaError = (err: unknown) => json({ error: errMsg(err) }, 502);
const query = (request: Request) => new URL(request.url).searchParams;

// El unique de os_kpis.label se traduce a 400 con el mismo texto que la version
// Astro, para no cambiar el mensaje que ve el UI de OSKpis.
function respuestaEscritura(err: unknown): Response {
  if (pgCode(err) === '23505') return json({ error: 'Ya existe un KPI con ese label' }, 400);
  return respuestaError(err);
}

export const Route = createFileRoute('/api/kpis')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const params = query(request);
          const serieId = params.get('serie');
          if (serieId) return json({ serie: await listarSerie(serieId, params.get('dias')) });
          return json({ kpis: await listarKpis() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.kpi_id) return json({ valor: await registrarValorKpi(body) }, 201);
          return json({ kpi: await crearKpi(body) }, 201);
        } catch (err) {
          if (err instanceof Error && (err.message === 'valor numerico requerido' || err.message === 'label requerido')) {
            return json({ error: err.message }, 400);
          }
          return respuestaEscritura(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = query(request).get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const body = (await request.json()) as Record<string, unknown>;
          return json({ kpi: await actualizarKpi(id, body) });
        } catch (err) {
          return respuestaEscritura(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = query(request).get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarKpi(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
