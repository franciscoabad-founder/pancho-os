// Server route de /api/habitos/checks, portada de src/pages/api/habitos/checks.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { registrarCheck, deshacerCheck } from '../../../server/habitos.checks.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/habitos/checks')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return registrarCheck(request);
      },
      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        return deshacerCheck(request);
      },
    },
  },
});
