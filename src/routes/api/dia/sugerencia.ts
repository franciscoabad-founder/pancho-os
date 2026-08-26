// GET /api/dia/sugerencia: temas recientes del brain como candidatos para el
// One Domino de hoy. Solo lectura, no escribe nada en os_dia.
//
// Si el brain falla o no hay GBRAIN_TOKEN se devuelve una lista vacia con 200,
// no un error: Hoy tiene que cargar igual aunque el brain este caido.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { sugerirDomino } from '../../../server/dia.handlers.ts';

export const Route = createFileRoute('/api/dia/sugerencia')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
        try {
          return json({ sugerencias: await sugerirDomino() });
        } catch {
          return json({ sugerencias: [] });
        }
      },
    },
  },
});
