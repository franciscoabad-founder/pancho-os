export const prerender = false;

import type { APIRoute } from 'astro';
import { isOsAuthorized, json } from '../../os/lib/osAuth';

export const POST: APIRoute = async (context) => {
  // Antes: solo cookie de navegador a mano, nunca aceptaba Bearer/X-OS-Token
  // (un agente no podia usar este endpoint aunque quisiera). Unificado al
  // mismo chequeo que el resto de la API.
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { request } = context;

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
