// Server route de /api/habitos, portada de src/pages/api/habitos.ts (Astro).
//
// Convive con src/routes/api/habitos/*.ts (brief, checks, cierre, journeys), igual
// que os-auth.ts convive con os-auth/. TanStack resuelve el archivo hermano como
// la ruta exacta y el directorio como los hijos.
//
// Delgada a proposito: solo auth. La logica vive en
// src/server/habitos.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  listarHabitos,
  crearHabito,
  actualizarHabito,
  archivarHabito,
} from '../../server/habitos.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/habitos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return listarHabitos(request);
      },
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return crearHabito(request);
      },
      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return actualizarHabito(request);
      },
      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return archivarHabito(request);
      },
    },
  },
});
