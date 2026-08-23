// Server route de /api/recordatorios, portada de src/pages/api/recordatorios.ts
// (Astro).
//
// Delgada a proposito: auth, lectura del Request y traduccion de errores a
// status HTTP. Las reglas viven en src/server/recordatorios.handlers.ts.
//
// Mismo contrato HTTP que la version Astro para que
// src/os/components/OSRecordatorios.tsx siga funcionando sin cambios.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  ErrorRecordatorios,
  actualizarRecordatorio,
  crearRecordatorio,
  eliminarRecordatorio,
  listarRecordatorios,
  type RecordatorioInput,
} from '../../server/recordatorios.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  if (err instanceof ErrorRecordatorios) return json({ error: err.message }, err.status);
  const msg = err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? JSON.stringify(err);
  return json({ error: msg }, 502);
}

async function leerCuerpo(request: Request): Promise<RecordatorioInput> {
  const body = await request.json();
  return (body ?? {}) as RecordatorioInput;
}

export const Route = createFileRoute('/api/recordatorios')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ recordatorios: await listarRecordatorios() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const recordatorio = await crearRecordatorio(await leerCuerpo(request));
          return json({ ok: true, recordatorio }, 201);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = await leerCuerpo(request);
          const url = new URL(request.url);
          const id = url.searchParams.get('id')
            ?? (body.id === undefined || body.id === null ? null : String(body.id));
          const recordatorio = await actualizarRecordatorio(id, body);
          return json({ ok: true, recordatorio });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        try {
          await eliminarRecordatorio(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
