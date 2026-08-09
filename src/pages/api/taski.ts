export const prerender = false;

import type { APIRoute } from 'astro';

// Taski: canal directo de chat con Hermes (agente del VPS).
// Proxy server-side hacia https://brain.franciscoabad.com/taski/* (Caddy),
// que a su vez llega al api_server local de hermes-gateway.
// La conversacion vive en UNA sola sesion continua: "pancho-os".

const TASKI_BASE = 'https://brain.franciscoabad.com/taski';
const SESSION_ID = 'pancho-os';
// Hermes piensa: timeout generoso.
const CHAT_TIMEOUT_MS = 60_000;
const HISTORY_TIMEOUT_MS = 15_000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function autorizado(cookies: { get: (name: string) => { value: string } | undefined }): boolean {
  const token = cookies.get('os_auth')?.value;
  const expected = import.meta.env.OS_AUTH_TOKEN;
  return Boolean(token && expected && token === expected);
}

function taskiHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${import.meta.env.TASKI_TOKEN}`,
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

export const GET: APIRoute = async ({ cookies }) => {
  if (!autorizado(cookies)) return json({ error: 'Unauthorized' }, 401);
  if (!import.meta.env.TASKI_TOKEN) return json({ error: 'TASKI_TOKEN no configurado' }, 500);

  try {
    let res = await taskiFetch(`/api/sessions/${SESSION_ID}/messages`, { method: 'GET' }, HISTORY_TIMEOUT_MS);
    if (res.status === 404) {
      await asegurarSesion();
      res = await taskiFetch(`/api/sessions/${SESSION_ID}/messages`, { method: 'GET' }, HISTORY_TIMEOUT_MS);
    }
    if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);
    const data = await res.json();
    const crudos: MensajeHermes[] = Array.isArray(data?.data) ? data.data : [];
    // Solo turnos de conversacion visibles (sin tool calls ni mensajes vacios).
    const mensajes = crudos
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content),
        timestamp: typeof m.timestamp === 'number' ? m.timestamp : null,
      }))
      .slice(-60);
    return json({ session_id: SESSION_ID, mensajes });
  } catch (err) {
    const abort = err instanceof Error && err.name === 'AbortError';
    return json({ error: abort ? 'Hermes tardo demasiado en responder' : String(err) }, 502);
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!autorizado(cookies)) return json({ error: 'Unauthorized' }, 401);
  if (!import.meta.env.TASKI_TOKEN) return json({ error: 'TASKI_TOKEN no configurado' }, 500);

  let message: string;
  try {
    const body = await request.json();
    message = (body.message ?? '').toString().trim();
  } catch {
    return json({ error: 'JSON invalido' }, 400);
  }
  if (!message) return json({ error: 'Mensaje requerido' }, 400);
  if (message.length > 4000) return json({ error: 'Mensaje demasiado largo (max 4000)' }, 400);

  try {
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
    const reply = data?.message?.content ?? '';
    return json({ reply: String(reply), session_id: SESSION_ID });
  } catch (err) {
    const abort = err instanceof Error && err.name === 'AbortError';
    return json(
      { error: abort ? 'Hermes tardo demasiado en responder. Intenta de nuevo.' : String(err) },
      502,
    );
  }
};
