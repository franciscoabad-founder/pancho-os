// /api/hermes/mensajes — ultimos mensajes de una sesion de Hermes
// (Fase 3, replica de Telegram). Solo lectura, con la sesion del OS.
// ?id=<sesion> &perfil=default &limite=120

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { leerMensajesSesion } from '../../../server/hermesSesiones.handlers.ts';

export const Route = createFileRoute('/api/hermes/mensajes')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
        const params = new URL(request.url).searchParams;
        try {
          const mensajes = await leerMensajesSesion(
            params.get('id') ?? '',
            params.get('perfil'),
            params.has('limite') ? Number(params.get('limite')) : undefined,
          );
          return json({ mensajes });
        } catch (err) {
          const texto = err instanceof Error ? err.message : String(err);
          const status = texto.includes('invalido') ? 400 : texto.includes('no encontrada') ? 404 : 502;
          return json({ error: texto }, status);
        }
      },
    },
  },
});
