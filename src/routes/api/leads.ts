// Server route de /api/leads, portada de src/pages/api/leads.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica vive en src/server/leads.handlers.ts.
//
// La forma de las respuestas es literal a la version Astro porque el MCP
// (crm_listar_leads, crm_crear_lead) consume este endpoint.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { errMsgCrudo } from '../../server/helpers.ts';
import {
  actualizarLead,
  crearLead,
  eliminarLead,
  listarLeads,
  type LeadInput,
} from '../../server/leads.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const respuestaError = (err: unknown) => json({ error: errMsgCrudo(err) }, 502);
const idDeQuery = (request: Request) => new URL(request.url).searchParams.get('id');

export const Route = createFileRoute('/api/leads')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ leads: await listarLeads() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as LeadInput;
          const lead = await crearLead(body);
          return json({ lead }, 201);
        } catch (err) {
          if (err instanceof Error && err.message === 'nombre requerido') {
            return json({ error: err.message }, 400);
          }
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const body = (await request.json()) as Record<string, unknown>;
          return json({ lead: await actualizarLead(id, body) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarLead(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
