import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { obtenerConexiones } from '../../server/conexiones.handlers.ts';

export const Route = createFileRoute('/api/conexiones')({
  server: { handlers: { GET: async ({ request }) => {
    if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
    try { return json(await obtenerConexiones()); } catch (error) { return json({ error: error instanceof Error ? error.message : 'No se pudieron cargar conexiones' }, 502); }
  } } },
});
