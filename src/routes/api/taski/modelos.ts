// Server route de /api/taski/modelos: catalogo real de modelos de Hermes y
// cambio de modelo POR SESION.
//
// GET  -> { modelos, fuente, aviso, modeloActivo, proveedorActivo }
//         `fuente` dice de donde salio la lista: 'options' (catalogo real de
//         GET /api/model/options), 'v1-models' (alias compatible con OpenAI) o
//         'fallback' (set de referencia del OS). La UI muestra `aviso` cuando
//         la fuente no es la buena, en vez de fingir que todo esta bien.
//         Pasar `session_id` para saber que modelo tiene bloqueado esa sesion.
// POST -> POST /api/sessions/{id}/model. Ya no hay fallback a /api/model:
//         ese endpoint no existe en el api_server de Hermes.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { cambiarModeloHermes, listarModelosHermes, SESSION_ID, taskiConfigurado } from '../../../server/taski.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
const sinToken = () => json({ error: 'TASKI_TOKEN no configurado' }, 500);
const PERFILES = ['vps-default', 'homelab-local', 'laptop-local'];

function errorHermes(err: unknown): Response {
  const abort = err instanceof Error && err.name === 'AbortError';
  return json({ error: abort ? 'Hermes tardo demasiado en responder' : String(err) }, 502);
}

export const Route = createFileRoute('/api/taski/modelos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();
        const params = new URL(request.url).searchParams;
        const perfil = params.get('profile_id')?.trim() || 'vps-default';
        if (!PERFILES.includes(perfil)) return json({ error: 'profile_id invalido' }, 400);
        const sessionId = params.get('session_id')?.trim() || undefined;

        try {
          const catalogo = await listarModelosHermes(perfil, sessionId);
          return json({ profile_id: perfil, session_id: sessionId ?? null, ...catalogo });
        } catch (err) {
          return errorHermes(err);
        }
      },
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        if (!taskiConfigurado()) return sinToken();

        let model: string;
        let provider: string | undefined;
        let sessionId: string;
        let perfil: string;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          model = (body.model ?? '').toString().trim();
          provider = (body.provider ?? '').toString().trim() || undefined;
          sessionId = (body.session_id ?? '').toString().trim() || SESSION_ID;
          perfil = (body.profile_id ?? '').toString().trim() || 'vps-default';
          if (!PERFILES.includes(perfil)) return json({ error: 'profile_id invalido' }, 400);
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }

        if (!model) {
          return json({ error: 'El campo model es requerido' }, 400);
        }

        try {
          const result = await cambiarModeloHermes(model, sessionId, perfil, provider);
          return json({ ...result, session_id: sessionId, profile_id: perfil });
        } catch (err) {
          return errorHermes(err);
        }
      },
    },
  },
});
