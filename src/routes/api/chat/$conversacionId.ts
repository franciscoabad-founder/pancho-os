// /api/chat/:conversacionId — hilo y envio del chat soberano.
//
// GET  -> hilo completo: conversacion + mensajes + run activo (para polling)
// POST -> enviar mensaje ({ contenido }); vuelve de inmediato con el run
//         'pendiente' y Hermes procesa en segundo plano.
//
// Callers: OSChat.tsx (frontend). Datos: tablas chat_* de la migracion
// 20260830000001_chat_soberano.sql.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { enviarMensaje, obtenerHilo, renombrarConversacion } from '../../../server/chat.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function aError(err: unknown): { texto: string; status: number } {
  const texto = String(err instanceof Error ? err.message : err);
  if (texto.includes('no encontrada')) return { texto, status: 404 };
  if (texto.includes('sigue trabajando')) return { texto, status: 409 };
  if (texto.includes('requerido') || texto.includes('demasiado largo')) return { texto, status: 400 };
  return { texto, status: 500 };
}

export const Route = createFileRoute('/api/chat/$conversacionId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json(await obtenerHilo(params.conversacionId));
        } catch (err) {
          const { texto, status } = aError(err);
          return json({ error: texto }, status);
        }
      },

      POST: async ({ request, params }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        let contenido: unknown;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          contenido = body.contenido ?? body.message;
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }
        try {
          return json(await enviarMensaje(params.conversacionId, contenido), 202);
        } catch (err) {
          const { texto, status } = aError(err);
          return json({ error: texto }, status);
        }
      },

      // PATCH -> renombrar la conversacion ({ titulo }). El nombre tambien se
      // replica a la sesion de Hermes para que se vea igual en la burbuja.
      PATCH: async ({ request, params }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        let titulo: unknown;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          titulo = body.titulo ?? body.title;
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }
        try {
          return json({ conversacion: await renombrarConversacion(params.conversacionId, titulo) });
        } catch (err) {
          const { texto, status } = aError(err);
          return json({ error: texto }, status);
        }
      },
    },
  },
});
