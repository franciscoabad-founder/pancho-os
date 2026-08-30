import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { errMsgCrudo } from '../../../server/helpers.ts';
import { actualizarFinanzasInbox, crearFinanzasInbox, listarFinanzasInbox } from '../../../server/finanzasInbox.handlers.ts';
const fail = (e: unknown, code = 400) => json({ error: errMsgCrudo(e) }, code);
export const Route = createFileRoute('/api/finanzas/inbox')({ server: { handlers: {
  GET: async ({ request }) => { if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401); try { return json({ items: await listarFinanzasInbox(new URL(request.url).searchParams.get('estado') || undefined) }); } catch (e) { return fail(e, 502); } },
  POST: async ({ request }) => { if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401); try { return json({ item: await crearFinanzasInbox(await request.json()) }, 201); } catch (e) { return fail(e); } },
  PATCH: async ({ request }) => { if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401); const id = new URL(request.url).searchParams.get('id'); if (!id) return json({ error: 'id requerido' }, 400); try { return json({ item: await actualizarFinanzasInbox(id, await request.json()) }); } catch (e) { return fail(e); } },
} } });
