// Server route de /api/taski/sesiones: conversaciones de Hermes que se pueden
// elegir desde el OS.
//
// GET   -> lista. `origen` = telegram | os | todas (default todas), para las
//          pestanas del selector. Ver listarSesionesTaski() en
//          src/server/taski.handlers.ts.
// PATCH -> renombrar una sesion ({ session_id, titulo }). Intenta persistir en
//          Hermes y siempre deja el alias en la base del OS. Ver
//          src/server/sesionAlias.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarSesionesTaski, taskiConfigurado, validarOrigen } from '../../../server/taski.handlers.ts';
import { aplicarAlias, mapaAlias, renombrarSesion } from '../../../server/sesionAlias.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const sinToken = () => json({ error: 'TASKI_TOKEN no configurado' }, 500);
const PERFILES = ['vps-default', 'homelab-local', 'laptop-local'];

// Mismo criterio que taski.ts: un abort del AbortController llega como
// AbortError, se traduce a un mensaje util en vez del stack crudo.
function errorHermes(err: unknown): Response {
  const abort = err instanceof Error && err.name === 'AbortError';
  return json({ error: abort ? 'Hermes tardo demasiado en responder' : String(err) }, 502);
}

export const Route = createFileRoute('/api/taski/sesiones')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();
        const params = new URL(request.url).searchParams;
        const perfil = params.get('profile_id')?.trim() || 'vps-default';
        if (!PERFILES.includes(perfil)) return json({ error: 'profile_id invalido' }, 400);
        const origen = validarOrigen(params.get('origen')?.trim());

        try {
          const [sesiones, alias] = await Promise.all([
            listarSesionesTaski(perfil, origen),
            mapaAlias(perfil),
          ]);
          return json({ profile_id: perfil, origen, sesiones: aplicarAlias(sesiones, alias) });
        } catch (err) {
          return errorHermes(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();

        let sessionId: string;
        let titulo: unknown;
        let perfil: string;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          sessionId = (body.session_id ?? '').toString().trim();
          titulo = body.titulo ?? body.title;
          perfil = (body.profile_id ?? '').toString().trim() || 'vps-default';
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }
        if (!PERFILES.includes(perfil)) return json({ error: 'profile_id invalido' }, 400);
        if (!sessionId) return json({ error: 'session_id es requerido' }, 400);

        try {
          return json(await renombrarSesion(sessionId, titulo, perfil));
        } catch (err) {
          const texto = String(err instanceof Error ? err.message : err);
          const cliente = texto.includes('requerido') || texto.includes('demasiado largo');
          return json({ error: texto }, cliente ? 400 : 502);
        }
      },
    },
  },
});
