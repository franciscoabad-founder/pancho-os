// Taski: canal directo de chat con Hermes (agente del VPS).
//
// Extraido de src/pages/api/taski.ts (Astro) sin cambios de comportamiento.
// Proxy server-side hacia https://brain.franciscoabad.com/taski/* (Caddy), que
// a su vez llega al api_server local de hermes-gateway (perfil "default": es
// el unico de los perfiles de Hermes que hoy tiene el api_server habilitado).
//
// SESSION_ID sigue siendo la sesion propia del OS (siempre disponible, se
// autocrea si no existe). Ademas de esa, Hermes ya guarda una sesion real por
// cada conversacion de Telegram: listarSesionesTaski() las trae para poder
// elegir cual ver, en vez de estar atados a una sola conversacion continua.

import { readEnv } from '../lib/env.ts';

const TASKI_BASE = 'https://brain.franciscoabad.com/taski';
export const SESSION_ID = 'pancho-os';
export type PerfilId = 'vps-default' | 'homelab-local' | 'laptop-local';

function basePerfil(perfil: PerfilId): string | undefined {
  if (perfil === 'vps-default') return readEnv('TASKI_BASE_URL') || TASKI_BASE;
  if (perfil === 'homelab-local') return readEnv('TASKI_BASE_HOMELAB');
  return readEnv('TASKI_BASE_LAPTOP');
}

export function validarPerfil(perfil: string | undefined): PerfilId {
  if (perfil === 'homelab-local' || perfil === 'laptop-local') return perfil;
  return 'vps-default';
}
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

async function taskiFetch(path: string, init: RequestInit, timeoutMs: number, perfil: PerfilId = 'vps-default'): Promise<Response> {
  const base = basePerfil(perfil);
  if (!base) throw new Error(`Perfil Hermes no configurado: ${perfil}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${base}${path}`, { ...init, headers: taskiHeaders(), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function asegurarSesion(sessionId: string, perfil: PerfilId = 'vps-default'): Promise<void> {
  // Solo la sesion propia del OS se autocrea. Las sesiones de Telegram son de
  // Hermes: si una ya no existe (borrada, etc.) no hay que resucitarla aca.
  if (sessionId !== SESSION_ID) return;
  // Crea la sesion estable si no existe (409 = ya existe, ok).
  await taskiFetch(
    '/api/sessions',
    { method: 'POST', body: JSON.stringify({ id: sessionId, title: 'Taski OS' }) },
    HISTORY_TIMEOUT_MS,
    perfil,
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

export async function historialTaski(sessionId: string = SESSION_ID, perfilRaw: string = 'vps-default'): Promise<MensajeTaski[]> {
  const perfil = validarPerfil(perfilRaw);
  let res = await taskiFetch(`/api/sessions/${sessionId}/messages`, { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil);
  if (res.status === 404) {
    await asegurarSesion(sessionId, perfil);
    res = await taskiFetch(`/api/sessions/${sessionId}/messages`, { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil);
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

export async function enviarATaski(message: string, sessionId: string = SESSION_ID, perfilRaw: string = 'vps-default'): Promise<string> {
  const perfil = validarPerfil(perfilRaw);
  const enviar = () =>
    taskiFetch(
      `/api/sessions/${sessionId}/chat`,
      { method: 'POST', body: JSON.stringify({ message }) },
      CHAT_TIMEOUT_MS,
      perfil,
    );

  let res = await enviar();
  if (res.status === 404) {
    await asegurarSesion(sessionId, perfil);
    res = await enviar();
  }
  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);

  const data = await res.json();
  return String(data?.message?.content ?? '');
}

export interface SesionTaski {
  id: string;
  source: string;
  title: string | null;
  preview: string | null;
  messageCount: number;
  lastActive: number | null;
}

function mapearSesion(cruda: Record<string, unknown>): SesionTaski {
  return {
    id: String(cruda.id ?? ''),
    source: typeof cruda.source === 'string' ? cruda.source : 'desconocido',
    title: typeof cruda.title === 'string' ? cruda.title : null,
    preview: typeof cruda.preview === 'string' ? cruda.preview : null,
    messageCount: typeof cruda.message_count === 'number' ? cruda.message_count : 0,
    lastActive: typeof cruda.last_active === 'number' ? cruda.last_active : null,
  };
}

// Cuantas sesiones de Telegram se traen como maximo. Hoy son ~12; 50 da
// margen sin pedirle a Hermes que pagine.
const LIMITE_SESIONES_TELEGRAM = 50;

async function obtenerSesionGeneral(perfil: PerfilId = 'vps-default'): Promise<SesionTaski> {
  const vacia: SesionTaski = {
    id: SESSION_ID,
    source: 'api_server',
    title: 'Taski (OS)',
    preview: null,
    messageCount: 0,
    lastActive: null,
  };
  const res = await taskiFetch(`/api/sessions/${SESSION_ID}`, { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil).catch(() => null);
  if (!res || !res.ok) return vacia; // 404 = primer uso, todavia no se creo sola
  const data = await res.json();
  return data?.session ? mapearSesion(data.session) : vacia;
}

// Sesiones que se pueden elegir desde el OS: la propia del OS primero, y
// despues cada conversacion de Telegram (una por chat/topic, ya separadas por
// Hermes). No se listan sesiones de cron/cli/desktop/a2a: son ejecuciones
// internas de Hermes, no conversaciones que Pancho tenga que revisar aca.
export async function listarSesionesTaski(perfilRaw: string = 'vps-default'): Promise<SesionTaski[]> {
  const perfil = validarPerfil(perfilRaw);
  const [general, res] = await Promise.all([
    obtenerSesionGeneral(perfil),
    taskiFetch(`/api/sessions?limit=${LIMITE_SESIONES_TELEGRAM}&source=telegram`, { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil),
  ]);
  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);

  const data = await res.json();
  const crudas: Record<string, unknown>[] = Array.isArray(data?.data) ? data.data : [];
  const telegram = crudas.map(mapearSesion).sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));
  return [general, ...telegram];
}

// ---------------------------------------------------------------------------
// Modelos de IA disponibles en Hermes
// ---------------------------------------------------------------------------

export interface ModeloHermes {
  id: string;
  name: string;
  provider?: string;
  description?: string;
  isCurrent?: boolean;
}

// Modelos canonicos de referencia que Hermes soporta en el VPS y HomeLab
const MODELOS_DEFAULT: ModeloHermes[] = [
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek v4 Flash (VPS)', provider: 'deepseek' },
  { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'anthropic/claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Fable)', provider: 'anthropic' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'custom/gemma-4-uncensored:latest', name: 'Gemma 4 (HomeLab Local)', provider: 'ollama' },
];

export async function listarModelosHermes(perfilRaw: string = 'vps-default'): Promise<ModeloHermes[]> {
  const perfil = validarPerfil(perfilRaw);
  try {
    const res = await taskiFetch('/v1/models', { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil);
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data?.data) ? data.data : [];
      if (items.length > 0) {
        return items.map((m: Record<string, unknown>) => ({
          id: String(m.id ?? ''),
          name: String(m.name ?? m.id ?? ''),
          provider: typeof m.owned_by === 'string' ? m.owned_by : undefined,
        }));
      }
    }
  } catch {
    // Si la llamada directa al gateway falla, retornamos el set conocido
  }
  return MODELOS_DEFAULT;
}

export async function cambiarModeloHermes(model: string, sessionId: string = SESSION_ID, perfilRaw: string = 'vps-default'): Promise<{ ok: boolean; model: string }> {
  const perfil = validarPerfil(perfilRaw);
  const res = await taskiFetch(
    `/api/sessions/${sessionId}/model`,
    { method: 'POST', body: JSON.stringify({ model }) },
    HISTORY_TIMEOUT_MS,
    perfil,
  ).catch(async () => {
    // Si la sesion no soporta lock individual, intenta configurar a nivel global
    return taskiFetch('/api/model', { method: 'POST', body: JSON.stringify({ model }) }, HISTORY_TIMEOUT_MS, perfil);
  });

  if (!res.ok) {
    throw new Error(`Hermes HTTP ${res.status} al cambiar modelo`);
  }
  return { ok: true, model };
}

// ---------------------------------------------------------------------------
// Perfiles de ejecucion (VPS, HomeLab, Laptop)
// ---------------------------------------------------------------------------

export interface PerfilHermes {
  id: string;
  nombre: string;
  tipo: 'vps' | 'homelab' | 'laptop';
  ubicacion: string;
  online: boolean;
  activo: boolean;
  modeloPrincipal: string;
  puerto: number;
}

export async function listarPerfilesHermes(): Promise<PerfilHermes[]> {
  const health = async (perfil: PerfilId): Promise<boolean> => {
    if (!basePerfil(perfil)) return false;
    try {
      const res = await taskiFetch('/api/sessions?limit=1', { method: 'GET' }, 5000, perfil);
      return res.ok;
    } catch { return false; }
  };
  const [vpsOnline, homelabOnline, laptopOnline] = await Promise.all([
    health('vps-default'), health('homelab-local'), health('laptop-local'),
  ]);

  return [
    {
      id: 'vps-default',
      nombre: 'VPS (Canónico / Alfred)',
      tipo: 'vps',
      ubicacion: 'Hetzner (pancho-automations-01)',
      online: vpsOnline,
      activo: true,
      modeloPrincipal: 'deepseek-v4-flash',
      puerto: 8642,
    },
    {
      id: 'homelab-local',
      nombre: 'HomeLab (Windows Pro / GPU)',
      tipo: 'homelab',
      ubicacion: 'HomeLab (Tailscale 100.127.201.2)',
      online: homelabOnline,
      activo: false,
      modeloPrincipal: 'gemma-4-uncensored',
      puerto: 9120,
    },
    {
      id: 'laptop-local',
      nombre: 'Laptop (Desarrollo)',
      tipo: 'laptop',
      ubicacion: 'Local (127.0.0.1 / Tailscale)',
      online: laptopOnline,
      activo: false,
      modeloPrincipal: 'gemma-4-uncensored',
      puerto: 9120,
    },
  ];
}

// ---------------------------------------------------------------------------
// Kanban y Tareas de Hermes
// ---------------------------------------------------------------------------

export interface TareaHermes {
  id: string;
  titulo: string;
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'fallida';
  perfil: string;
  creadaEn: number | null;
  detalle?: string;
}

export async function listarJobsHermes(perfilRaw: string = 'vps-default'): Promise<TareaHermes[]> {
  const perfil = validarPerfil(perfilRaw);
  try {
    const res = await taskiFetch('/api/jobs', { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil);
    if (res.ok) {
      const data = await res.json();
      const jobs = Array.isArray(data?.jobs ?? data?.data) ? (data.jobs ?? data.data) : [];
      return jobs.map((j: Record<string, unknown>) => ({
        id: String(j.id ?? ''),
        titulo: String(j.title ?? j.name ?? j.command ?? 'Tarea sin titulo'),
        estado: (j.status === 'running' ? 'en_progreso' : j.status === 'completed' ? 'completada' : j.status === 'failed' ? 'fallida' : 'pendiente') as TareaHermes['estado'],
        perfil: perfil,
        creadaEn: typeof j.created_at === 'number' ? j.created_at : null,
        detalle: typeof j.description === 'string' ? j.description : undefined,
      }));
    }
  } catch {
    // Si no hay endpoint /api/jobs habilitado, devolvemos tareas de ejemplo estructuradas
  }

  return [];
}

