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

  const n8nUrl = import.meta.env.N8N_ASSISTANT_URL;
  if (!n8nUrl) return json({ error: 'N8N_ASSISTANT_URL no configurado' }, 500);

  let pregunta: string;
  try {
    const body = await request.json();
    pregunta = (body.pregunta ?? '').toString().trim();
  } catch {
    return json({ error: 'JSON invalido' }, 400);
  }
  if (!pregunta) return json({ error: 'Pregunta requerida' }, 400);

  try {
    const res = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta }),
    });
    if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);
    const data = await res.json();
    const respuesta =
      data.response ?? data.answer ?? data.text ?? data.output ?? data.respuesta ?? JSON.stringify(data);
    return json({ respuesta: String(respuesta) });
  } catch (err) {
    return json({ error: String(err) }, 502);
  }
};
