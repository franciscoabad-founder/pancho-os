import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { ErrorAgendaGoogle, syncAgendaGoogle } from '../../../server/agenda.google.ts';
import { defaultRango } from '../../../server/agenda.handlers.ts';

export const Route = createFileRoute('/api/agenda/sync')({
  server: { handlers: {
    POST: async ({ request }) => {
      if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
      const url = new URL(request.url);
      const range = defaultRango(url.searchParams.get('desde'), url.searchParams.get('hasta'));
      try { return json({ ok: true, ...await syncAgendaGoogle(range.desde, range.hasta) }); }
      catch (err) { const status = err instanceof ErrorAgendaGoogle ? err.status : 502; return json({ error: err instanceof Error ? err.message : String(err) }, status); }
    },
  } },
});
