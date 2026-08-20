export const prerender = false;

import type { APIRoute } from 'astro';
import { isOsAuthorized } from '../../os/lib/osAuth';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const adminToken = import.meta.env.CORTEX_ADMIN_TOKEN;
  if (!adminToken) return json({ error: 'CORTEX_ADMIN_TOKEN no configurado' }, 500);

  const cortexAppUrl = import.meta.env.CORTEX_APP_URL || 'https://app-cortex.franciscoabad.com';

  try {
    const res = await fetch(`${cortexAppUrl}/api/admin/overview`, {
      method: 'GET',
      headers: {
        'X-Cortex-Admin-Token': adminToken,
      },
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return json(data, res.status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: `Error al conectar con Cortex: ${msg}` }, 502);
  }
};
