// Server route de /api/dia, portada de src/pages/api/dia.ts (Astro).
//
// Delgada a proposito: auth, parseo del Request y traduccion de errores a
// status HTTP. La logica de negocio vive en src/server/dia.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  crearWin,
  eliminarWin,
  obtenerDia,
  upsertDia,
} from '../../server/dia.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : 'error desconocido';
  return json({ error: msg }, 502);
}

const MENSAJES_400 = ['win.texto requerido', 'win_id requerido'];

function es400(err: unknown): boolean {
  return err instanceof Error && MENSAJES_400.includes(err.message);
}

export const Route = createFileRoute('/api/dia')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const fecha = new URL(request.url).searchParams.get('fecha');
          return json(await obtenerDia(fecha));
        } catch (err) {
          return respuestaError(err);
        }
      },

      PUT: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          return json({ dia: await upsertDia(body) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          return json({ dia: await upsertDia(body) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const win = body.win ?? {};
          const winGuardado = await crearWin(body.fecha as string | undefined, win as { texto?: string; categoria?: string | null });
          return json({ ok: true, win: winGuardado }, 201);
        } catch (err) {
          if (es400(err)) return json({ error: (err as Error).message }, 400);
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const winId = new URL(request.url).searchParams.get('win_id');
        if (!winId) return json({ error: 'win_id requerido' }, 400);
        try {
          await eliminarWin(winId);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
