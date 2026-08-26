// Server route de /api/notas, portada de src/pages/api/notas.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica de negocio vive en src/server/notas.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  actualizarNota,
  convertirNota,
  crearNota,
  eliminarNota,
  listarNotas,
  type ConvertirInput,
  type NotaInput,
} from '../../server/notas.handlers.ts';
import { ErrorPendientes } from '../../server/pendientes.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, 502);
}

async function leerCuerpo(request: Request): Promise<NotaInput> {
  const body = await request.json();
  return (body ?? {}) as NotaInput;
}

const idDeQuery = (request: Request) => new URL(request.url).searchParams.get('id');

export const Route = createFileRoute('/api/notas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ notas: await listarNotas() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          if (body.convertir) {
            const resultado = await convertirNota((body.convertir ?? {}) as ConvertirInput);
            return json({ ok: true, nota: resultado.nota, creado: resultado.creado, destino: resultado.destino }, 201);
          }
          const nota = await crearNota(body as NotaInput);
          return json({ ok: true, nota }, 201);
        } catch (err) {
          if (err instanceof Error && err.message === 'contenido requerido') {
            return json({ error: err.message }, 400);
          }
          if (err instanceof ErrorPendientes) return json({ error: err.message }, err.status);
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request) ?? ((await request.clone().json().catch(() => ({}))) as Record<string, unknown>).id;
        if (!id || typeof id !== 'string') return json({ error: 'id requerido' }, 400);
        try {
          const nota = await actualizarNota(id, await leerCuerpo(request));
          return json({ ok: true, nota });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarNota(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
