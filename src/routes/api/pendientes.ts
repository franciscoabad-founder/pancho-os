// Server route de /api/pendientes, portada de src/pages/api/pendientes.ts (Astro).
//
// Delgada a proposito: auth, lectura del Request y traduccion de errores a
// status HTTP. Las reglas viven en src/server/pendientes.handlers.ts.
//
// Mismo contrato HTTP que la version Astro (mismos verbos, mismos codigos,
// mismas claves de respuesta) para que src/os/components/OSPendientes.tsx siga
// funcionando con su fetch('/api/pendientes') sin cambios.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  ErrorPendientes,
  actualizarPendiente,
  crearPendiente,
  eliminarPendiente,
  listarPendientes,
  type PendienteInput,
} from '../../server/pendientes.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// ErrorPendientes trae su propio status (400). Para el resto se conserva el
// mismo mensaje que armaba Astro, incluido el JSON.stringify del caso raro.
function respuestaError(err: unknown): Response {
  if (err instanceof ErrorPendientes) return json({ error: err.message }, err.status);
  const msg = err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? JSON.stringify(err);
  return json({ error: msg }, 502);
}

async function leerCuerpo(request: Request): Promise<PendienteInput> {
  const body = await request.json();
  return (body ?? {}) as PendienteInput;
}

export const Route = createFileRoute('/api/pendientes')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ pendientes: await listarPendientes() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const pendiente = await crearPendiente(await leerCuerpo(request));
          return json({ ok: true, pendiente }, 201);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = await leerCuerpo(request);
          // El id puede venir por query (?id=) o dentro del cuerpo, igual que en
          // Astro: OSPendientes.tsx usa la query, otros clientes el cuerpo.
          const url = new URL(request.url);
          const id = url.searchParams.get('id')
            ?? (body.id === undefined || body.id === null ? null : String(body.id));
          const pendiente = await actualizarPendiente(id, body);
          return json({ ok: true, pendiente });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        try {
          await eliminarPendiente(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
