// Server route de /api/taski/perfiles: consulta el estado de salud y disponibilidad
// de los perfiles de ejecucion de Hermes (VPS, HomeLab, Laptop).

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarPerfilesHermes } from '../../../server/taski.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/taski/perfiles')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        try {
          return json({ perfiles: await listarPerfilesHermes() });
        } catch (err) {
          return json({ error: String(err) }, 500);
        }
      },
    },
  },
});
