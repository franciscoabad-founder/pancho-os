// /api/hermes/skills — skills de Hermes (Fase 4, Capabilities en el OS).
// GET  ?perfil=arazza  -> lista
// PUT  { nombre, activa, perfil? } -> activa o desactiva (cambia la config real de Hermes)
// Ambos exigen la sesion del OS.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { cambiarSkill, listarSkills } from '../../../server/hermesSkills.handlers.ts';

const estado = (texto: string) => (texto.includes('invalido') || texto.includes('debe ser') ? 400 : 502);

export const Route = createFileRoute('/api/hermes/skills')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
        try {
          return json({ skills: await listarSkills(new URL(request.url).searchParams.get('perfil')) });
        } catch (err) {
          const texto = err instanceof Error ? err.message : String(err);
          return json({ error: texto }, estado(texto));
        }
      },
      PUT: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
        let cuerpo: { nombre?: unknown; activa?: unknown; perfil?: unknown };
        try {
          cuerpo = (await request.json()) as typeof cuerpo;
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }
        try {
          return json(await cambiarSkill(cuerpo.nombre, cuerpo.activa, typeof cuerpo.perfil === 'string' ? cuerpo.perfil : null));
        } catch (err) {
          const texto = err instanceof Error ? err.message : String(err);
          return json({ error: texto }, estado(texto));
        }
      },
    },
  },
});
