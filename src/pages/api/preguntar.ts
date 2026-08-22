export const prerender = false;

import type { APIRoute } from 'astro';
import { isOsAuthorized, json } from '../../os/lib/osAuth';

export const POST: APIRoute = async (context) => {
  // Ver capturar.ts: mismo unificado a isOsAuthorized (acepta Bearer/X-OS-Token).
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { request } = context;

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
