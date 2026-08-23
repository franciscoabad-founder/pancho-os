// Server route de /api/habitos/brief, portada de src/pages/api/habitos/brief.ts.
//
// El original aceptaba `isOsAuthorized(context) || isExternalTokenAuthorized(context)`
// porque la version Astro de isOsAuthorized solo miraba la cookie de sesion. El
// isOsAuthorized de src/server/osAuth.ts ya cubre los tres caminos (cookie,
// Bearer/X-OS-Token del .env, token de dispositivo emparejado), asi que el segundo
// chequeo quedaria contenido en el primero. Se deja un solo await.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { brief } from '../../../server/habitos.brief.handlers.ts';

export const Route = createFileRoute('/api/habitos/brief')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
        return brief();
      },
    },
  },
});
