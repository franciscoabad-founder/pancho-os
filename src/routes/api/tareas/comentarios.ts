// /api/tareas/comentarios -- CON AUTH. Comentarios sobre una tarea (parte del
// feed unificado tarea_eventos; ver ese modulo para 'cambio'/'sistema').
//
//   GET    ?tarea_id=       -> lista, mismo shape que el feed de /$id
//   POST   {tarea_id,cuerpo} -> crea
//   PATCH  ?id=  {cuerpo}    -> edita (solo el propio autor)
//   DELETE ?id=              -> borra (solo el propio autor)
//
// El autor SIEMPRE sale de identidadCliente(request), nunca del body: mismo
// principio que journal_log fijando fuente:'hermes'.

import { createFileRoute } from '@tanstack/react-router';
import { identidadCliente, isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import {
  ErrorTareaEventos,
  actualizarComentario,
  crearComentario,
  eliminarComentario,
  listarEventos,
} from '../../../server/tareaEventos.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  if (err instanceof ErrorTareaEventos) return json({ error: err.message }, err.status);
  const msg = err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? JSON.stringify(err);
  return json({ error: msg }, 502);
}

export const Route = createFileRoute('/api/tareas/comentarios')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const tareaId = new URL(request.url).searchParams.get('tarea_id');
        if (!tareaId) return json({ error: 'tarea_id requerido' }, 400);
        try {
          const eventos = await listarEventos(getSupabaseServer(), tareaId, 'comentario');
          return json({ eventos });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const tareaId = typeof body.tarea_id === 'string' ? body.tarea_id : '';
          if (!tareaId) return json({ error: 'tarea_id requerido' }, 400);
          const actor = await identidadCliente(request);
          const origen = typeof body.origen === 'string' ? body.origen : 'os';
          const evento = await crearComentario(tareaId, String(body.cuerpo ?? ''), actor, origen);
          return json({ ok: true, evento }, 201);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const actor = await identidadCliente(request);
          const evento = await actualizarComentario(id, String(body.cuerpo ?? ''), actor);
          return json({ ok: true, evento });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const actor = await identidadCliente(request);
          await eliminarComentario(id, actor);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
