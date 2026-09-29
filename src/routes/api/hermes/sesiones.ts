// /api/hermes/sesiones — sesiones de Hermes de todos los perfiles y canales
// (Fase 2). Solo lectura, con la sesion del OS (isOsAuthorized).
// Filtros: ?perfil=arazza &canal=telegram &limite=200 &desplazamiento=0

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarSesionesHermes } from '../../../server/hermesSesiones.handlers.ts';
import { CANALES_HERMES, type CanalHermesId } from '../../../os/lib/canalesHermes.ts';

export const Route = createFileRoute('/api/hermes/sesiones')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
        const params = new URL(request.url).searchParams;
        const canalCrudo = params.get('canal');
        const canal = CANALES_HERMES.some((c) => c.id === canalCrudo) ? (canalCrudo as CanalHermesId) : null;
        try {
          return json(
            await listarSesionesHermes({
              perfil: params.get('perfil'),
              canal,
              limite: params.has('limite') ? Number(params.get('limite')) : undefined,
              desplazamiento: params.has('desplazamiento') ? Number(params.get('desplazamiento')) : undefined,
            }),
          );
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, 502);
        }
      },
    },
  },
});
