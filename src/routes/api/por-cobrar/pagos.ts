import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { errMsgCrudo } from '../../../server/helpers.ts';
import { crearPagoPorCobrar, eliminarPagoPorCobrar, listarPagosPorCobrar, type PagoPorCobrarInput } from '../../../server/porCobrarPagos.handlers.ts';

const error = (e: unknown) => json({ error: errMsgCrudo(e) }, 400);
export const Route = createFileRoute('/api/por-cobrar/pagos')({ server: { handlers: {
  GET: async ({ request }) => { if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401); try { return json({ pagos: await listarPagosPorCobrar(new URL(request.url).searchParams.get('por_cobrar_id') || undefined) }); } catch (e) { return error(e); } },
  POST: async ({ request }) => { if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401); try { return json({ pago: await crearPagoPorCobrar(await request.json() as PagoPorCobrarInput) }, 201); } catch (e) { return error(e); } },
  DELETE: async ({ request }) => { if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401); const id = new URL(request.url).searchParams.get('id'); if (!id) return json({ error: 'id requerido' }, 400); try { await eliminarPagoPorCobrar(id); return json({ ok: true }); } catch (e) { return error(e); } },
} } });
