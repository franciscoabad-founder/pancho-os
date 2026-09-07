// /api/chat: chat soberano del OS (ver os-chat-telegram-soberano en el brain).
//
// GET  -> lista de conversaciones
// POST -> crear conversacion ({ titulo?, perfil?, perfil_hermes? })
//
// `perfil` es el NODO (vps-default | homelab-local | laptop-local) y
// `perfil_hermes` el agente real (default | arazza | nerio | rafik | taskr).
// Los dos son opcionales: sin ellos se crea con Alfred en el VPS, igual que
// antes de F2.
//
// El hilo y el envio de mensajes viven en /api/chat/$conversacionId.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { crearConversacion, listarConversaciones } from '../../server/chat.handlers.ts';
import { IDS_PERFILES_HERMES } from '../../os/lib/perfilesHermes.ts';

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
        // Un perfil que no existe se rechaza en vez de caer silenciosamente a
        // Alfred: si el cliente pidio Rafik y le contestamos Alfred, el tema
        // queda con la memoria del agente equivocado.
        const perfilHermes = body.perfil_hermes;
        if (perfilHermes !== undefined && !IDS_PERFILES_HERMES.includes(perfilHermes as never)) {
          return json({ error: `perfil_hermes invalido. Validos: ${IDS_PERFILES_HERMES.join(', ')}` }, 400);
        }
        try {
          return json({ conversacion: await crearConversacion(body.titulo, body.perfil, perfilHermes) }, 201);
        } catch (err) {
          return json({ error: String(err instanceof Error ? err.message : err) }, 500);
        }
      },
    },
  },
});
