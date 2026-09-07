// /api/chat/:conversacionId/stream — mismo envio que el POST de
// /api/chat/:conversacionId, pero devolviendo el turno en vivo por SSE.
//
// POST { contenido } -> text/event-stream con los eventos de Hermes
// (run.started, assistant.delta, tool.*, message.completed, run.completed).
//
// El run se persiste igual que en el camino sincronico: si el cliente cierra
// la pestana, el turno sigue y la respuesta queda guardada (ver
// procesarRunStream en chat.handlers.ts). Por eso el cliente puede volver al
// polling de /api/chat/:id sin perder nada.
//
// Callers: OSChat.tsx.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../../server/osAuth.ts';
import { enviarMensajeStream } from '../../../../server/chat.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// Mismos codigos que /api/chat/$conversacionId: el cliente ya los interpreta.
function aError(err: unknown): { texto: string; status: number } {
  const texto = String(err instanceof Error ? err.message : err);
  if (texto.includes('no encontrada')) return { texto, status: 404 };
  if (texto.includes('sigue trabajando')) return { texto, status: 409 };
  if (texto.includes('requerido') || texto.includes('demasiado largo')) return { texto, status: 400 };
  return { texto, status: 500 };
}

export const Route = createFileRoute('/api/chat/$conversacionId/stream')({
  server: {
    handlers: {
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
          const stream = await enviarMensajeStream(params.conversacionId, contenido);
          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              // Sin transformaciones intermedias: si Caddy o Nitro comprimen o
              // bufferean, los deltas llegan todos juntos al final y el
              // streaming deja de servir para algo.
              'Cache-Control': 'no-cache, no-transform',
              'X-Accel-Buffering': 'no',
              Connection: 'keep-alive',
            },
          });
        } catch (err) {
          const { texto, status } = aError(err);
          return json({ error: texto }, status);
        }
      },
    },
  },
});
