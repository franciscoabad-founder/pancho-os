// /api/chat: chat soberano del OS (ver os-chat-telegram-soberano en el brain).
//
// GET  -> lista de conversaciones
// POST -> crear conversacion ({ titulo?, perfil? })
//
// El hilo y el envio de mensajes viven en /api/chat/$conversacionId.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { crearConversacion, listarConversaciones } from '../../server/chat.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ conversaciones: await listarConversaciones() });
        } catch (err) {
          return json({ error: String(err instanceof Error ? err.message : err) }, 500);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          // cuerpo vacio permitido: crea con defaults
        }
        try {
          return json({ conversacion: await crearConversacion(body.titulo, body.perfil) }, 201);
        } catch (err) {
          return json({ error: String(err instanceof Error ? err.message : err) }, 500);
        }
      },
    },
  },
});
