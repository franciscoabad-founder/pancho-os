// Server route de /api/taski, portada de src/pages/api/taski.ts (Astro).
//
// Delgada a proposito: auth, parseo del cuerpo y traduccion de errores. El
// proxy hacia Hermes vive en src/server/taski.handlers.ts.
//
// Cambio de auth respecto de Astro: la version vieja comparaba a mano la cookie
// os_auth contra OS_AUTH_TOKEN. Aca se usa isOsAuthorized (superset: cookie,
// token del .env y dispositivo emparejado), igual que el resto de la API.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  MAX_LARGO_MENSAJE,
  SESSION_ID,
  enviarATaski,
  historialTaski,
  taskiConfigurado,
} from '../../server/taski.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const sinToken = () => json({ error: 'TASKI_TOKEN no configurado' }, 500);

// Un abort del AbortController llega como AbortError: se traduce a un mensaje
// util en vez del stack crudo.
function errorHermes(err: unknown, mensajeTimeout: string): Response {
  const abort = err instanceof Error && err.name === 'AbortError';
  return json({ error: abort ? mensajeTimeout : String(err) }, 502);
}

export const Route = createFileRoute('/api/taski')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();

        const sessionId = new URL(request.url).searchParams.get('session_id')?.trim() || SESSION_ID;
        const perfil = new URL(request.url).searchParams.get('profile_id')?.trim() || 'vps-default';
        if (!['vps-default', 'homelab-local', 'laptop-local'].includes(perfil)) return json({ error: 'profile_id invalido' }, 400);
        try {
          return json({ session_id: sessionId, profile_id: perfil, mensajes: await historialTaski(sessionId, perfil) });
        } catch (err) {
          return errorHermes(err, 'Hermes tardo demasiado en responder');
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();

        let message: string;
        let sessionId: string;
        let perfil: string;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          message = (body.message ?? '').toString().trim();
          sessionId = (body.session_id ?? '').toString().trim() || SESSION_ID;
          perfil = (body.profile_id ?? '').toString().trim() || 'vps-default';
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }
        if (!['vps-default', 'homelab-local', 'laptop-local'].includes(perfil)) return json({ error: 'profile_id invalido' }, 400);
        if (!message) return json({ error: 'Mensaje requerido' }, 400);
        if (message.length > MAX_LARGO_MENSAJE) {
          return json({ error: `Mensaje demasiado largo (max ${MAX_LARGO_MENSAJE})` }, 400);
        }

        try {
          return json({ reply: await enviarATaski(message, sessionId, perfil), session_id: sessionId, profile_id: perfil });
        } catch (err) {
          return errorHermes(err, 'Hermes tardo demasiado en responder. Intenta de nuevo.');
        }
      },
    },
  },
});
