export const prerender = false;

import type { APIRoute } from 'astro';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  const adminToken = import.meta.env.CORTEX_ADMIN_TOKEN;
  if (!adminToken) return json({ error: 'CORTEX_ADMIN_TOKEN no configurado' }, 500);

  const cortexAppUrl = import.meta.env.CORTEX_APP_URL || 'https://app-cortex.franciscoabad.com';

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON invalido' }, 400);
  }

  const nombre = (body.nombre ?? '').toString().trim();
  const email = (body.email ?? '').toString().trim();
  const consentimiento_datos = body.consentimiento_datos === true;

  if (!nombre) return json({ error: 'nombre requerido' }, 400);
  if (!email) return json({ error: 'email requerido' }, 400);
  if (!consentimiento_datos) return json({ error: 'consentimiento_datos requerido' }, 400);

  const payload = {
    nombre,
    email,
    empresa: body.empresa ? String(body.empresa).trim() : undefined,
    rol: body.rol ? String(body.rol).trim() : undefined,
    telefono: body.telefono ? String(body.telefono).trim() : undefined,
    tz: body.tz ? String(body.tz).trim() : undefined,
    objetivo: body.objetivo ? String(body.objetivo).trim() : undefined,
    consentimiento_datos: true,
  };

  try {
    const res = await fetch(`${cortexAppUrl}/api/os/invitar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cortex-Admin-Token': adminToken,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000),
    });
    const data = await res.json();
    return json(data, res.status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: `Error al conectar con Cortex: ${msg}` }, 502);
  }
};
