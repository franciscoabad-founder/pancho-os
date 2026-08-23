// Captura rapida: manda el texto al webhook de n8n (CAPTURE_WEBHOOK_URL), que
// lo deposita en la bandeja del cerebro.
//
// Extraido de src/pages/api/capturar.ts (Astro) sin cambios de comportamiento.

import { readEnv } from '../lib/env.ts';

export async function capturarTexto(texto: string): Promise<void> {
  const webhook = readEnv('CAPTURE_WEBHOOK_URL');
  if (!webhook) throw new Error('CAPTURE_WEBHOOK_URL no configurado');

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, source: 'os-capture', ts: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`webhook HTTP ${res.status}`);
}
