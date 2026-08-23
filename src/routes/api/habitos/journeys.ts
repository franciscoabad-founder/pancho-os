// Server route de /api/habitos/journeys, portada de
// src/pages/api/habitos/journeys.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarJourneys, accionJourney } from '../../../server/habitos.journeys.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/habitos/journeys')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return listarJourneys();
      },
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return accionJourney(request);
      },
    },
  },
});
