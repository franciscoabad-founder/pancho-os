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

// Token por perfil: cada gateway de Hermes tiene su propia API_SERVER_KEY.
// Los perfiles nuevos usan TASKI_TOKEN_LAPTOP / TASKI_TOKEN_HOMELAB; si faltan
// se cae al TASKI_TOKEN historico (que es el del VPS).
function tokenPerfil(perfil: PerfilId): string | undefined {
  if (perfil === 'laptop-local') return readEnv('TASKI_TOKEN_LAPTOP') || readEnv('TASKI_TOKEN');
  if (perfil === 'homelab-local') return readEnv('TASKI_TOKEN_HOMELAB') || readEnv('TASKI_TOKEN');
  return readEnv('TASKI_TOKEN');
}

function taskiHeaders(perfil: PerfilId = 'vps-default'): Record<string, string> {
  return {
    Authorization: `Bearer ${tokenPerfil(perfil)}`,
    'Content-Type': 'application/json',
  };
}

async function taskiFetch(path: string, init: RequestInit, timeoutMs: number, perfil: PerfilId = 'vps-default'): Promise<Response> {
  const base = basePerfil(perfil);
  if (!base) throw new Error(`Perfil Hermes no configurado: ${perfil}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${base}${path}`, { ...init, headers: taskiHeaders(perfil), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function asegurarSesion(sessionId: string, perfil: PerfilId = 'vps-default'): Promise<void> {
  // Solo la sesion propia del OS se autocrea. Las sesiones de Telegram son de
  // Hermes: si una ya no existe (borrada, etc.) no hay que resucitarla aca.
  if (sessionId !== SESSION_ID) return;
  await crearSesionTaski(sessionId, 'Taski OS', perfil);
}

// Crea una sesion en Hermes si no existe (409 = ya existia, ok). La usa el
// chat soberano para sus sesiones os-chat-* (una por conversacion del OS).
export async function crearSesionTaski(sessionId: string, titulo: string, perfilRaw: string = 'vps-default'): Promise<void> {
  const perfil = validarPerfil(perfilRaw);
  await taskiFetch(
    '/api/sessions',
    { method: 'POST', body: JSON.stringify({ id: sessionId, title: titulo }) },
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
  /** Epoch en MILISEGUNDOS. Hermes lo entrega en segundos (ver aMilisegundos). */
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
      // Hermes guarda epoch en segundos: mandarlo crudo hacia new Date() daba
      // horas de 1970 en la vista de solo lectura de /chat.
      timestamp: aMilisegundos(m.timestamp),
    }))
    .slice(-MAX_MENSAJES);
}

export async function enviarATaski(message: string, sessionId: string = SESSION_ID, perfilRaw: string = 'vps-default', timeoutMs: number = CHAT_TIMEOUT_MS): Promise<string> {
  const perfil = validarPerfil(perfilRaw);
  const enviar = () =>
    taskiFetch(
      `/api/sessions/${sessionId}/chat`,
      { method: 'POST', body: JSON.stringify({ message }) },
      timeoutMs,
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

/** De donde nace la conversacion, para las pestanas del selector del OS. */
export type OrigenSesion = 'telegram' | 'os';
export type FiltroOrigen = OrigenSesion | 'todas';

export function validarOrigen(valor: string | undefined | null): FiltroOrigen {
  if (valor === 'telegram' || valor === 'os') return valor;
  return 'todas';
}

export interface SesionTaski {
  id: string;
  source: string;
  /** telegram = chat/topic de Telegram; os = creada por el OS via HTTP. */
  origen: OrigenSesion;
  title: string | null;
  preview: string | null;
  messageCount: number;
  /** Epoch en MILISEGUNDOS. Hermes lo entrega en segundos; se normaliza aca. */
  lastActive: number | null;
  /** Modelo bloqueado en la sesion, si Hermes lo reporta. */
  model: string | null;
}

/**
 * Hermes guarda `last_active` como epoch en segundos (float). Mandarlo crudo a
 * `new Date()` en el frontend daba fechas de 1970, que es parte de por que el
 * desplegable nunca mostro fecha. Se normaliza a milisegundos aca, una sola
 * vez, y se tolera que una build vieja ya mande milisegundos.
 */
export function aMilisegundos(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' ? Number(valor) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  // 1e12 ms = sep 2001. Cualquier cosa por debajo son segundos.
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
}

/**
 * Clasificacion de origen. `telegram` es el `source` que pone el adaptador de
 * Telegram; el resto de conversaciones que le interesan al OS nacen por HTTP
 * (source `api_server`) con id `pancho-os` u `os-chat-*`. Las sesiones de
 * cron, cli, desktop y a2a son ejecuciones internas de Hermes: no son
 * conversaciones que Pancho tenga que revisar, y se descartan.
 */
export function clasificarOrigen(source: string, id: string): OrigenSesion | null {
  if (source === 'telegram') return 'telegram';
  if (source === 'api_server') return 'os';
  if (id === SESSION_ID || id.startsWith('os-chat-')) return 'os';
  return null;
}

function mapearSesion(cruda: Record<string, unknown>): SesionTaski {
  const id = String(cruda.id ?? '');
  const source = typeof cruda.source === 'string' ? cruda.source : 'desconocido';
  return {
    id,
    source,
    origen: clasificarOrigen(source, id) ?? 'os',
    title: typeof cruda.title === 'string' ? cruda.title : null,
    preview: typeof cruda.preview === 'string' ? cruda.preview : null,
    messageCount: typeof cruda.message_count === 'number' ? cruda.message_count : 0,
    lastActive: aMilisegundos(cruda.last_active),
    model: typeof cruda.model === 'string' && cruda.model.trim() ? cruda.model : null,
  };
}

// Cuantas sesiones se traen como maximo. Antes eran solo las de Telegram (~12);
// ahora tambien entran las del chat propio del OS, asi que el tope sube. El
// api_server acepta hasta 200.
const LIMITE_SESIONES = 120;

async function obtenerSesionGeneral(perfil: PerfilId = 'vps-default'): Promise<SesionTaski> {
  const vacia: SesionTaski = {
    id: SESSION_ID,
    source: 'api_server',
    origen: 'os',
    title: 'Taski (OS)',
    preview: null,
    messageCount: 0,
    lastActive: null,
    model: null,
  };
  const res = await taskiFetch(`/api/sessions/${SESSION_ID}`, { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil).catch(() => null);
  if (!res || !res.ok) return vacia; // 404 = primer uso, todavia no se creo sola
  const data = await res.json();
  return data?.session ? mapearSesion(data.session) : vacia;
}

/**
 * Sesiones que se pueden elegir desde el OS, ordenadas por ultima actividad.
 *
 * Antes esto pedia `?source=telegram`, asi que las conversaciones de /chat
 * (sesiones `os-chat-*`, source `api_server`) NUNCA aparecian en la burbuja ni
 * en el cockpit: eran dos mundos separados. Ahora se pide la lista completa y
 * se clasifica aca con clasificarOrigen(), de modo que el OS puede ofrecer las
 * pestanas Telegram / OS / Todas sin hacer dos viajes. Las sesiones de
 * cron/cli/desktop/a2a se siguen descartando: son ejecuciones internas de
 * Hermes, no conversaciones.
 *
 * La sesion legacy del OS (`pancho-os`) va siempre primero y se autocrea, para
 * que la burbuja tenga a donde escribir aunque Hermes no liste nada.
 */
export async function listarSesionesTaski(
  perfilRaw: string = 'vps-default',
  filtro: FiltroOrigen = 'todas',
): Promise<SesionTaski[]> {
  const perfil = validarPerfil(perfilRaw);
  const [general, res] = await Promise.all([
    obtenerSesionGeneral(perfil),
    taskiFetch(`/api/sessions?limit=${LIMITE_SESIONES}`, { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil),
  ]);
  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);

  const data = await res.json();
  const crudas: Record<string, unknown>[] = Array.isArray(data?.data) ? data.data : [];
  const resto = crudas
    .map(mapearSesion)
    .filter((s) => s.id && s.id !== SESSION_ID && clasificarOrigen(s.source, s.id) !== null)
    .sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));

  const todas = [general, ...resto];
  if (filtro === 'todas') return todas;
  // La sesion legacy del OS cuenta como 'os', asi que el filtro la respeta.
  return todas.filter((s) => s.origen === filtro);
}

// ---------------------------------------------------------------------------
// Modelos de IA disponibles en Hermes
// ---------------------------------------------------------------------------
//
// Historia (auditoria del 6 sep 2026, seccion f): el OS leia GET /v1/models,
// que es el alias compatible con OpenAI y solo anuncia UN modelo virtual
// ("hermes-agent") mas los alias de model_routes. Por eso el desplegable
// mostraba "hermes-agent" y nada mas.
//
// El catalogo real vive en GET /api/model/options (mismo inventario que usan
// el dashboard y el TUI de Hermes). Devuelve
//   { providers: [{ slug, name, models: [...], is_current, authenticated,
//                   total_models, warning }], model, provider }
// donde `model` y `provider` de primer nivel son los configurados hoy en el
// gateway. Ver hermes_cli/inventory.py, build_model_options_payload.
//
// Orden de intento: /api/model/options -> /v1/models -> MODELOS_DEFAULT.
// La fuente viaja hasta la UI para poder avisar de forma discreta que se esta
// mostrando un catalogo degradado en vez de mentir con una lista bonita.

export interface ModeloHermes {
  /** Clave unica para el <select>: "proveedor/modelo" (o el id crudo). */
  id: string;
  name: string;
  provider?: string;
  /** Id del modelo tal como lo espera Hermes, sin el prefijo de proveedor. */
  modelId?: string;
  description?: string;
  isCurrent?: boolean;
}

export type FuenteModelos = 'options' | 'v1-models' | 'fallback';

export interface CatalogoModelos {
  modelos: ModeloHermes[];
  fuente: FuenteModelos;
  /** Texto corto para la UI cuando la fuente no es la buena. */
  aviso: string | null;
  /** Modelo bloqueado en la sesion consultada, si se pudo leer. */
  modeloActivo: string | null;
  proveedorActivo: string | null;
}

// Modelos canonicos de referencia que Hermes soporta en el VPS y HomeLab.
// Ultimo recurso: solo se usan si Hermes no contesta ninguno de los dos
// endpoints de catalogo.
const MODELOS_DEFAULT: ModeloHermes[] = [
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek v4 Flash (VPS)', provider: 'deepseek', modelId: 'deepseek-v4-flash' },
  { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', modelId: 'claude-3-5-sonnet' },
  { id: 'anthropic/claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Fable)', provider: 'anthropic', modelId: 'claude-3-7-sonnet' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', modelId: 'gpt-4o' },
  { id: 'custom/gemma-4-uncensored:latest', name: 'Gemma 4 (HomeLab Local)', provider: 'ollama', modelId: 'gemma-4-uncensored:latest' },
];

// El id virtual que /v1/models anuncia cuando no hay alias configurados. No es
// un modelo real de ningun proveedor: Hermes mismo lo anula si se lo mandan de
// vuelta (_session_runtime_request_from_body). Si el catalogo trae solo esto,
// no sirve como lista de modelos.
const MODELO_VIRTUAL = 'hermes-agent';

function componerId(provider: string | undefined, modelId: string): string {
  const p = (provider ?? '').trim();
  return p ? `${p}/${modelId}` : modelId;
}

/** Separa "openrouter/deepseek/chat" en proveedor + modelo, como hace Hermes. */
export function partirModelo(id: string): { provider?: string; model: string } {
  const limpio = (id ?? '').trim();
  const corte = limpio.indexOf('/');
  if (corte <= 0) return { model: limpio };
  return { provider: limpio.slice(0, corte), model: limpio.slice(corte + 1) };
}

interface FilaProveedor {
  slug?: unknown;
  name?: unknown;
  models?: unknown;
  is_current?: unknown;
  authenticated?: unknown;
  total_models?: unknown;
  warning?: unknown;
}

/** Aplana el payload de /api/model/options a la lista plana del desplegable. */
export function aplanarOpcionesModelo(payload: Record<string, unknown>): ModeloHermes[] {
  const filas: FilaProveedor[] = Array.isArray(payload?.providers) ? (payload.providers as FilaProveedor[]) : [];
  const modeloActual = typeof payload?.model === 'string' ? payload.model : '';
  const proveedorActual = typeof payload?.provider === 'string' ? payload.provider.toLowerCase() : '';

  const salida: ModeloHermes[] = [];
  const vistos = new Set<string>();
  for (const fila of filas) {
    const slug = typeof fila.slug === 'string' ? fila.slug : '';
    if (!slug) continue;
    const etiqueta = typeof fila.name === 'string' && fila.name.trim() ? fila.name : slug;
    const modelos = Array.isArray(fila.models) ? fila.models : [];
    for (const crudo of modelos) {
      const modelId = String(crudo ?? '').trim();
      if (!modelId || modelId === MODELO_VIRTUAL) continue;
      const id = componerId(slug, modelId);
      if (vistos.has(id)) continue;
      vistos.add(id);
      salida.push({
        id,
        name: `${modelId} — ${etiqueta}`,
        provider: slug,
        modelId,
        // Solo el proveedor no autenticado necesita explicacion en la UI.
        description: fila.authenticated === false
          ? (typeof fila.warning === 'string' ? fila.warning : 'Proveedor sin credencial activa en Hermes')
          : undefined,
        isCurrent: slug.toLowerCase() === proveedorActual && modelId === modeloActual,
      });
    }
  }
  return salida;
}

/** Modelo bloqueado en una sesion concreta (campo `model` de la sesion). */
export async function modeloDeSesion(sessionId: string, perfil: PerfilId): Promise<string | null> {
  try {
    const res = await taskiFetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil);
    if (!res.ok) return null;
    const data = await res.json();
    const modelo = data?.session?.model;
    return typeof modelo === 'string' && modelo.trim() && modelo !== MODELO_VIRTUAL ? modelo : null;
  } catch {
    return null;
  }
}

export async function listarModelosHermes(perfilRaw: string = 'vps-default', sessionId?: string): Promise<CatalogoModelos> {
  const perfil = validarPerfil(perfilRaw);

  const activoSesion = sessionId ? await modeloDeSesion(sessionId, perfil) : null;
  const conActivo = (cat: Omit<CatalogoModelos, 'modeloActivo' | 'proveedorActivo'>): CatalogoModelos => {
    // Preferencia: lo que la sesion tiene bloqueado; si no, el marcado como
    // actual por el gateway.
    const porSesion = activoSesion
      ? cat.modelos.find((m) => m.id === activoSesion || m.modelId === activoSesion)
      : undefined;
    const elegido = porSesion ?? cat.modelos.find((m) => m.isCurrent) ?? null;
    return {
      ...cat,
      modeloActivo: elegido?.id ?? activoSesion ?? null,
      proveedorActivo: elegido?.provider ?? null,
    };
  };

  // 1. Catalogo real del gateway.
  try {
    const res = await taskiFetch('/api/model/options', { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil);
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      const modelos = aplanarOpcionesModelo(data);
      if (modelos.length > 0) return conActivo({ modelos, fuente: 'options', aviso: null });
    }
  } catch {
    // sigue al fallback
  }

  // 2. Fallback historico: el alias compatible con OpenAI. Solo tiene valor si
  //    trae algo mas que el modelo virtual "hermes-agent".
  try {
    const res = await taskiFetch('/v1/models', { method: 'GET' }, HISTORY_TIMEOUT_MS, perfil);
    if (res.ok) {
      const data = await res.json();
      const items: Record<string, unknown>[] = Array.isArray(data?.data) ? data.data : [];
      const modelos = items
        .map((m) => {
          const crudo = String(m.id ?? '').trim();
          const { provider, model } = partirModelo(crudo);
          return {
            id: crudo,
            name: String(m.name ?? crudo),
            provider: typeof m.owned_by === 'string' ? m.owned_by : provider,
            modelId: model,
          } satisfies ModeloHermes;
        })
        .filter((m) => m.id && m.id !== MODELO_VIRTUAL);
      if (modelos.length > 0) {
        return conActivo({
          modelos,
          fuente: 'v1-models',
          aviso: 'Hermes no expuso /api/model/options; lista tomada de /v1/models (alias, no el catalogo completo).',
        });
      }
    }
  } catch {
    // sigue al fallback
  }

  // 3. Set de referencia: la UI avisa que no son modelos verificados.
  return conActivo({
    modelos: MODELOS_DEFAULT,
    fuente: 'fallback',
    aviso: 'Hermes no devolvio su catalogo de modelos. Lista de referencia, el cambio puede fallar.',
  });
}

/**
 * Bloquea el modelo de UNA sesion: POST /api/sessions/{id}/model.
 *
 * Se quito el fallback historico a POST /api/model: ese endpoint no existe en
 * el api_server (lo que existe es GET /api/model/options), asi que solo servia
 * para convertir un error claro en un 404 confuso.
 */
export async function cambiarModeloHermes(
  model: string,
  sessionId: string = SESSION_ID,
  perfilRaw: string = 'vps-default',
  providerRaw?: string,
): Promise<{ ok: boolean; model: string; provider?: string }> {
  const perfil = validarPerfil(perfilRaw);
  const partido = partirModelo(model);
  const provider = (providerRaw ?? '').trim() || partido.provider;
  const modelId = provider && partido.provider === provider ? partido.model : model;

  const res = await taskiFetch(
    `/api/sessions/${encodeURIComponent(sessionId)}/model`,
    { method: 'POST', body: JSON.stringify(provider ? { model: modelId, provider } : { model: modelId }) },
    HISTORY_TIMEOUT_MS,
    perfil,
  );

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Hermes HTTP ${res.status} al cambiar modelo${detalle ? `: ${detalle.slice(0, 300)}` : ''}`);
  }
  return { ok: true, model: modelId, provider };
}

// ---------------------------------------------------------------------------
// Renombrar una sesion de Hermes
// ---------------------------------------------------------------------------

/**
 * PATCH /api/sessions/{id} {"title": ...}. El api_server acepta el campo
 * `title` (ver _handle_patch_session). Devuelve false, sin tirar, si la build
 * desplegada no soporta el metodo o el perfil no responde: el llamador se
 * queda con el alias local del OS.
 */
export async function renombrarSesionHermes(sessionId: string, titulo: string, perfilRaw: string = 'vps-default'): Promise<boolean> {
  const perfil = validarPerfil(perfilRaw);
  try {
    const res = await taskiFetch(
      `/api/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'PATCH', body: JSON.stringify({ title: titulo }) },
      HISTORY_TIMEOUT_MS,
      perfil,
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Perfiles de ejecucion (VPS, HomeLab, Laptop)
// ---------------------------------------------------------------------------

export interface PerfilHermes {
  id: string;
  nombre: string;
  tipo: 'vps' | 'homelab' | 'laptop';
  ubicacion: string;
  /** El health check contesto. */
  online: boolean;
  /** Se puede seleccionar en el cockpit. Se deriva de online, ya no es fijo. */
  activo: boolean;
  /** Por que no esta disponible (tooltip de la UI). null si esta operativo. */
  motivo: string | null;
  /** false = al perfil le faltan TASKI_BASE_* / TASKI_TOKEN_* en el .env. */
  configurado: boolean;
  modeloPrincipal: string;
  puerto: number;
}

// Puerto del api_server de Hermes. Antes decia 9120 para HomeLab y Laptop:
// 9120 es `hermes serve` (backend del Desktop), no el api_server HTTP, asi que
// era un dato falso en la UI. El api_server siempre es 8642.
const PUERTO_API_SERVER = 8642;

function motivoNoDisponible(configurado: boolean, online: boolean, nodo: string): string | null {
  if (!configurado) {
    return `Falta configurarlo en el .env del OS (TASKI_BASE_* y TASKI_TOKEN_* de ${nodo}). Sin base URL no hay a donde preguntar.`;
  }
  if (!online) {
    return `${nodo} no responde el health check. Revisa que el equipo este encendido, en la tailnet y con api_server habilitado en el puerto ${PUERTO_API_SERVER}.`;
  }
  return null;
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
  const vpsConf = Boolean(basePerfil('vps-default'));
  const homelabConf = Boolean(basePerfil('homelab-local'));
  const laptopConf = Boolean(basePerfil('laptop-local'));

  return [
    {
      id: 'vps-default',
      nombre: 'VPS (Canónico / Alfred)',
      tipo: 'vps',
      ubicacion: 'Hetzner (pancho-automations-01)',
      online: vpsOnline,
      activo: vpsOnline,
      motivo: motivoNoDisponible(vpsConf, vpsOnline, 'El VPS'),
      configurado: vpsConf,
      modeloPrincipal: 'deepseek-v4-flash',
      puerto: PUERTO_API_SERVER,
    },
    {
      id: 'homelab-local',
      nombre: 'HomeLab (Windows Pro / GPU)',
      tipo: 'homelab',
      ubicacion: 'HomeLab (Tailscale 100.127.201.2)',
      online: homelabOnline,
      activo: homelabOnline,
      motivo: motivoNoDisponible(homelabConf, homelabOnline, 'El HomeLab'),
      configurado: homelabConf,
      modeloPrincipal: 'gemma-4-uncensored',
      puerto: PUERTO_API_SERVER,
    },
    {
      id: 'laptop-local',
      nombre: 'Laptop (Desarrollo)',
      tipo: 'laptop',
      ubicacion: 'Laptop (Tailscale 100.106.81.110)',
      online: laptopOnline,
      activo: laptopOnline,
      motivo: motivoNoDisponible(laptopConf, laptopOnline, 'La laptop'),
      configurado: laptopConf,
      modeloPrincipal: 'gemma-4-uncensored',
      puerto: PUERTO_API_SERVER,
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

