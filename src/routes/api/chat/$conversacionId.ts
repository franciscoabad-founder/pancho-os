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
import {
  desvincularTopic,
  enviarMensaje,
  obtenerHilo,
  parsearTopicTelegram,
  renombrarConversacion,
  vincularTopic,
} from '../../../server/chat.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function aError(err: unknown): { texto: string; status: number } {
  const texto = String(err instanceof Error ? err.message : err);
  if (texto.includes('no encontrada')) return { texto, status: 404 };
  if (texto.includes('ya esta vinculado')) return { texto, status: 409 };
  if (texto.includes('invalido')) return { texto, status: 400 };
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

      // PATCH -> dos operaciones sobre la conversacion, segun que campo venga:
      //   { titulo }          renombrar (el nombre se replica a Hermes)
      //   { topic_telegram }  vincular a un topic de Telegram, o null para
      //                       desvincular (F3). Formato '<chat_id>:<thread_id>'.
      //                       El vinculo es una referencia de agrupacion: no
      //                       comparte memoria con el topic ni toca la
      //                       session_key del tema.
      PATCH: async ({ request, params }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }

        if ('topic_telegram' in body) {
          const crudo = body.topic_telegram;
          try {
            if (crudo === null) {
              return json({ conversacion: await desvincularTopic(params.conversacionId) });
            }
            const topic = parsearTopicTelegram(crudo);
            if (!topic) {
              return json({ error: 'topic_telegram invalido (se espera "<chat_id>:<thread_id>" o null)' }, 400);
            }
            return json({ conversacion: await vincularTopic(params.conversacionId, topic.chatId, topic.threadId) });
          } catch (err) {
            const { texto, status } = aError(err);
            return json({ error: texto }, status);
          }
        }

        try {
          const titulo = body.titulo ?? body.title;
          return json({ conversacion: await renombrarConversacion(params.conversacionId, titulo) });
        } catch (err) {
          const { texto, status } = aError(err);
          return json({ error: texto }, status);
        }
      },
    },
  },
});
