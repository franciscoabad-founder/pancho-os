export const prerender = false;

import type { APIRoute } from 'astro';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ cookies, request }) => {
  const token = cookies.get('os_auth')?.value;
  const expected = import.meta.env.OS_AUTH_TOKEN;
  if (!token || !expected || token !== expected) return json({ error: 'Unauthorized' }, 401);

  const webhook = import.meta.env.CAPTURE_WEBHOOK_URL;
  if (!webhook) return json({ error: 'CAPTURE_WEBHOOK_URL no configurado' }, 500);

  let texto: string;
  try {
    const body = await request.json();
    texto = (body.texto ?? '').toString().trim();
  } catch {
    return json({ error: 'JSON invalido' }, 400);
  }
  if (!texto) return json({ error: 'Texto requerido' }, 400);

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, source: 'os-capture', ts: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`webhook HTTP ${res.status}`);
    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) }, 502);
  }
};
