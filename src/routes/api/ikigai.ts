// Server route de /api/ikigai. Delgada a proposito: auth, parseo del
// Request, traduccion de errores a status HTTP. La logica vive en
// src/server/ikigai.handlers.ts.
//
// GET               -> estado completo del mapa activo (items, zonas, cobertura)
// GET ?mapas=1       -> lista de versiones (para la pantalla de deriva)
// GET ?deriva=A,B    -> comparacion entre dos mapas por id
// POST {mapa}        -> nueva version del diagnostico
// POST {item}        -> agrega frase a un cuadrante
// POST {zona}        -> crea zona de vida
// POST {pulso}       -> registra pulso mensual de una zona
// PATCH ?zona=id      -> actualiza cuadrantes de una zona
// DELETE ?item=id | ?zona=id

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  agregarItem,
  crearNuevoMapa,
  crearZona,
  derivaEntreMapas,
  eliminarItem,
  eliminarZona,
  listarMapas,
  obtenerEstado,
  registrarPulso,
  actualizarZona,
} from '../../server/ikigai.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const ES_400 = /requerido|invalido|invalida|sin campos|no encontrada/i;

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, ES_400.test(msg) ? 400 : 502);
}

export const Route = createFileRoute('/api/ikigai')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const params = new URL(request.url).searchParams;
        try {
          if (params.get('mapas')) {
            return json({ mapas: await listarMapas() });
          }
          const derivaParam = params.get('deriva');
          if (derivaParam) {
            const [anteriorId, actualId] = derivaParam.split(',');
            return json({ deriva: await derivaEntreMapas(anteriorId ?? null, actualId ?? null) });
          }
          return json(await obtenerEstado());
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

          if (body.mapa && typeof body.mapa === 'object') {
            const { titulo, nota } = body.mapa as { titulo?: unknown; nota?: unknown };
            return json({ ok: true, mapa: await crearNuevoMapa(titulo, nota) }, 201);
          }
          if (body.item && typeof body.item === 'object') {
            const { mapa_id, cuadrante, texto } = body.item as { mapa_id?: string; cuadrante?: unknown; texto?: unknown };
            return json({ ok: true, item: await agregarItem(mapa_id ?? null, cuadrante, texto) }, 201);
          }
          if (body.zona && typeof body.zona === 'object') {
            const { mapa_id, nombre, cuadrantes, descripcion } = body.zona as {
              mapa_id?: string; nombre?: unknown; cuadrantes?: unknown; descripcion?: unknown;
            };
            return json({ ok: true, zona: await crearZona(mapa_id ?? null, nombre, cuadrantes, descripcion) }, 201);
          }
          if (body.pulso && typeof body.pulso === 'object') {
            const { zona_id, periodo, nivel, nota } = body.pulso as {
              zona_id?: string; periodo?: unknown; nivel?: unknown; nota?: unknown;
            };
            await registrarPulso(zona_id ?? null, periodo, nivel, nota);
            return json({ ok: true }, 201);
          }
          return json({ error: 'body invalido: usa {mapa}, {item}, {zona} o {pulso}' }, 400);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const params = new URL(request.url).searchParams;
        const zonaId = params.get('zona');
        if (!zonaId) return json({ error: 'zona requerido' }, 400);
        try {
          const body = (await request.json().catch(() => ({}))) as { cuadrantes?: unknown };
          return json({ ok: true, zona: await actualizarZona(zonaId, body.cuadrantes) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const params = new URL(request.url).searchParams;
        try {
          const itemId = params.get('item');
          if (itemId) {
            await eliminarItem(itemId);
            return json({ ok: true });
          }
          const zonaId = params.get('zona');
          if (zonaId) {
            await eliminarZona(zonaId);
            return json({ ok: true });
          }
          return json({ error: 'item o zona requerido' }, 400);
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
