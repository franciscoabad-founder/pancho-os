// Puente hacia el asistente de n8n (N8N_ASSISTANT_URL), el "chat con el
// cerebro" de la barra de comandos del OS.
//
// Extraido de src/pages/api/preguntar.ts (Astro) sin cambios de comportamiento.

import { readEnv } from '../lib/env.ts';

/**
 * Manda la pregunta a n8n y normaliza la respuesta. n8n devuelve el texto bajo
 * claves distintas segun el nodo final del flujo, asi que se prueban todas antes
 * de caer al JSON crudo.
 */
export async function preguntarAlCerebro(pregunta: string): Promise<string> {
  const n8nUrl = readEnv('N8N_ASSISTANT_URL');
  if (!n8nUrl) throw new Error('N8N_ASSISTANT_URL no configurado');

  const res = await fetch(n8nUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pregunta }),
  });
  if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);

  const data = await res.json();
  const respuesta =
    data.response ?? data.answer ?? data.text ?? data.output ?? data.respuesta ?? JSON.stringify(data);
  return String(respuesta);
}
