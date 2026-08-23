// Taski: canal directo de chat con Hermes (agente del VPS).
//
// Extraido de src/pages/api/taski.ts (Astro) sin cambios de comportamiento.
// Proxy server-side hacia https://brain.franciscoabad.com/taski/* (Caddy), que
// a su vez llega al api_server local de hermes-gateway. La conversacion vive en
// UNA sola sesion continua: "pancho-os".

import { readEnv } from '../lib/env.ts';

const TASKI_BASE = 'https://brain.franciscoabad.com/taski';
export const SESSION_ID = 'pancho-os';
// Hermes piensa: timeout generoso.
const CHAT_TIMEOUT_MS = 60_000;
const HISTORY_TIMEOUT_MS = 15_000;

// Solo se muestran los ultimos N turnos de conversacion.
const MAX_MENSAJES = 60;
export const MAX_LARGO_MENSAJE = 4000;

function taskiHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${readEnv('TASKI_TOKEN')}`,
    'Content-Type': 'application/json',
  };
}

async function taskiFetch(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${TASKI_BASE}${path}`, { ...init, headers: taskiHeaders(), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function asegurarSesion(): Promise<void> {
  // Crea la sesion estable si no existe (409 = ya existe, ok).
  await taskiFetch(
    '/api/sessions',
    { method: 'POST', body: JSON.stringify({ id: SESSION_ID, title: 'Taski OS' }) },
    HISTORY_TIMEOUT_MS,
  ).catch(() => undefined);
}

interface MensajeHermes {
  role?: string;
  content?: string | null;
  timestamp?: number;
  tool_calls?: unknown;
}

export interface MensajeTaski {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number | null;
}

/** true si TASKI_TOKEN esta configurado. La route lo traduce a 500. */
export function taskiConfigurado(): boolean {
  return Boolean(readEnv('TASKI_TOKEN'));
}

export async function historialTaski(): Promise<MensajeTaski[]> {
  let res = await taskiFetch(`/api/sessions/${SESSION_ID}/messages`, { method: 'GET' }, HISTORY_TIMEOUT_MS);
  if (res.status === 404) {
    await asegurarSesion();
    res = await taskiFetch(`/api/sessions/${SESSION_ID}/messages`, { method: 'GET' }, HISTORY_TIMEOUT_MS);
  }
  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);

  const data = await res.json();
  const crudos: MensajeHermes[] = Array.isArray(data?.data) ? data.data : [];
  // Solo turnos de conversacion visibles (sin tool calls ni mensajes vacios).
  return crudos
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content),
      timestamp: typeof m.timestamp === 'number' ? m.timestamp : null,
    }))
    .slice(-MAX_MENSAJES);
}

export async function enviarATaski(message: string): Promise<string> {
  const enviar = () =>
    taskiFetch(
      `/api/sessions/${SESSION_ID}/chat`,
      { method: 'POST', body: JSON.stringify({ message }) },
      CHAT_TIMEOUT_MS,
    );

  let res = await enviar();
  if (res.status === 404) {
    await asegurarSesion();
    res = await enviar();
  }
  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);

  const data = await res.json();
  return String(data?.message?.content ?? '');
}
