// Server route de /api/journal (modulo Diario).
//
// Delgada a proposito, igual que /api/notas: auth, parseo del Request y
// traduccion de errores a status HTTP. La logica vive en
// src/server/journal.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  actualizarEntrada,
  crearEntrada,
  eliminarEntrada,
  listarEntradas,
  promoverAContenido,
  detectarSugerencias,
  type EntradaInput,
} from '../../server/journal.handlers.ts';
import { sincronizarDiaAlBrain } from '../../server/journal.brain.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// Errores de validacion del handler: son culpa del cliente, no del upstream.
const ES_400 = /requerido|invalid|sin campos|no encontrada/i;

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, ES_400.test(msg) ? 400 : 502);
}

const idDeQuery = (request: Request) => new URL(request.url).searchParams.get('id');

export const Route = createFileRoute('/api/journal')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const params = new URL(request.url).searchParams;
        try {
          const entradas = await listarEntradas({
            fecha: params.get('fecha'),
            tipo: params.get('tipo'),
            limit: params.get('limit'),
          });
          return json({ entradas });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          // Puente al organo de contenido: {promover: {id}} crea la idea.
          if (body.promover && typeof body.promover === 'object') {
            const { id } = body.promover as { id?: string };
            const resultado = await promoverAContenido(id ?? null);
            return json({ ok: true, entrada: resultado.entrada, idea: resultado.idea }, 201);
          }
          const entrada = await crearEntrada(body as EntradaInput);
          let brain_sync: unknown = null;
          try { brain_sync = await sincronizarDiaAlBrain(entrada.fecha); } catch (err) { brain_sync = { error: err instanceof Error ? err.message : String(err) }; }
          return json({ ok: true, entrada, brain_sync, sugerencias: detectarSugerencias(entrada.contenido) }, 201);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const body = (await request.json().catch(() => ({}))) as EntradaInput;
          const entrada = await actualizarEntrada(id, body);
          let brain_sync: unknown = null;
          try { brain_sync = await sincronizarDiaAlBrain(entrada.fecha); } catch (err) { brain_sync = { error: err instanceof Error ? err.message : String(err) }; }
          return json({ ok: true, entrada, brain_sync });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarEntrada(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
