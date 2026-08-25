// Server route de /api/red (modulo Networking Room; nombre corto de tabla
// "red" por Willburn/Ibarra & Hunter, ver nota en red.handlers.ts). Delgada
// a proposito, la logica vive en src/server/red.handlers.ts y
// src/server/red.puente-tareas.ts.
//
// GET                  -> {personas, conexiones}
// GET ?diagnostico=1    -> scorecard completo
// GET ?plan=1           -> plan activo + objetivos
// POST {persona}        -> crea persona
// POST {conexion}       -> conecta dos personas
// POST {contacto}       -> registra interaccion de hoy con una persona
// POST {plan}           -> crea plan (meta, frontera)
// POST {objetivo}       -> agrega persona objetivo a un plan
// POST {generar_tareas} -> dispara el puente hacia `tareas` para la semana dada
// PATCH ?persona=id      -> actualiza campos de una persona
// PATCH ?objetivo=id     -> actualiza estado de un objetivo
// DELETE ?persona=id     -> archiva (no borra)
// DELETE ?conexion=A,B   -> desconecta dos personas

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  actualizarEstadoObjetivo,
  actualizarPersona,
  agregarObjetivo,
  archivarPersona,
  conectarPersonas,
  crearPersona,
  crearPlan,
  desconectarPersonas,
  listarConexiones,
  listarPersonas,
  obtenerDiagnostico,
  obtenerPlanActivo,
  registrarContacto,
} from '../../server/red.handlers.ts';
import { generarTareasSemana } from '../../server/red.puente-tareas.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const ES_400 = /requerido|invalido|invalida|sin campos|misma\b/i;

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, ES_400.test(msg) ? 400 : 502);
}

export const Route = createFileRoute('/api/red')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const params = new URL(request.url).searchParams;
        try {
          if (params.get('diagnostico')) return json(await obtenerDiagnostico());
          if (params.get('plan')) return json(await obtenerPlanActivo());
          const [personas, conexiones] = await Promise.all([listarPersonas(true), listarConexiones()]);
          return json({ personas, conexiones });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

          if (body.persona && typeof body.persona === 'object') {
            return json({ ok: true, persona: await crearPersona(body.persona as Record<string, unknown>) }, 201);
          }
          if (body.conexion && typeof body.conexion === 'object') {
            const { persona_a, persona_b } = body.conexion as { persona_a?: string; persona_b?: string };
            return json({ ok: true, conexion: await conectarPersonas(persona_a ?? null, persona_b ?? null) }, 201);
          }
          if (body.contacto && typeof body.contacto === 'object') {
            const { persona_id, fecha } = body.contacto as { persona_id?: string; fecha?: string };
            return json({ ok: true, persona: await registrarContacto(persona_id ?? null, fecha) });
          }
          if (body.plan && typeof body.plan === 'object') {
            const { meta, frontera, horizonte_fin } = body.plan as { meta?: unknown; frontera?: unknown; horizonte_fin?: unknown };
            return json({ ok: true, plan: await crearPlan(meta, frontera, horizonte_fin) }, 201);
          }
          if (body.objetivo && typeof body.objetivo === 'object') {
            const { plan_id, persona_id, tactica } = body.objetivo as { plan_id?: string; persona_id?: string; tactica?: unknown };
            return json({ ok: true, objetivo: await agregarObjetivo(plan_id ?? null, persona_id ?? null, tactica) }, 201);
          }
          if (body.generar_tareas && typeof body.generar_tareas === 'object') {
            const { semana } = body.generar_tareas as { semana?: string };
            return json({ ok: true, resultado: await generarTareasSemana(semana ?? '') });
          }
          return json({ error: 'body invalido: usa {persona}, {conexion}, {contacto}, {plan}, {objetivo} o {generar_tareas}' }, 400);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const params = new URL(request.url).searchParams;
        try {
          const personaId = params.get('persona');
          if (personaId) {
            const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
            return json({ ok: true, persona: await actualizarPersona(personaId, body) });
          }
          const objetivoId = params.get('objetivo');
          if (objetivoId) {
            const body = (await request.json().catch(() => ({}))) as { estado?: unknown };
            return json({ ok: true, objetivo: await actualizarEstadoObjetivo(objetivoId, body.estado) });
          }
          return json({ error: 'persona o objetivo requerido' }, 400);
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const params = new URL(request.url).searchParams;
        try {
          const personaId = params.get('persona');
          if (personaId) {
            await archivarPersona(personaId);
            return json({ ok: true });
          }
          const conexionParam = params.get('conexion');
          if (conexionParam) {
            const [a, b] = conexionParam.split(',');
            await desconectarPersonas(a ?? null, b ?? null);
            return json({ ok: true });
          }
          return json({ error: 'persona o conexion requerido' }, 400);
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
