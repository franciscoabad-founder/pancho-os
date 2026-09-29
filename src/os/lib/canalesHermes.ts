// Canales y sesiones de Hermes, vistos desde el OS (Fase 2, 29-sep-2026).
//
// Hermes guarda cada conversacion como una "sesion" con un `source` (de donde
// vino) y un `profile` (que agente la tuvo). Este archivo traduce esos datos
// crudos a lo que el OS muestra: nombre, color e icono por canal, y para
// Telegram el grupo y el topic. Es puro (sin red) y vive en os/lib para que lo
// usen el servidor y el navegador. Lo consume src/server/hermesSesiones.handlers.ts
// y la pagina src/routes/hermes_/sesiones.tsx.

import { etiquetaPerfilHermes } from './perfilesHermes.ts';

export type CanalHermesId =
  | 'telegram'
  | 'os'
  | 'desktop'
  | 'cron'
  | 'puente'
  | 'oneshot'
  | 'terminal'
  | 'otro';

export interface CanalHermesCatalogo {
  id: CanalHermesId;
  etiqueta: string;
  /** Color del chip (hex). Un solo tono por canal, legible en claro y oscuro. */
  color: string;
  /** Nombre de Material Symbols, el set de iconos que ya usa el OS. */
  icono: string;
  /** Valores de `source` de Hermes que caen en este canal. */
  sources: string[];
}

export const CANALES_HERMES: CanalHermesCatalogo[] = [
  { id: 'telegram', etiqueta: 'Telegram', color: '#2AABEE', icono: 'send', sources: ['telegram'] },
  { id: 'os', etiqueta: 'Pancho OS', color: '#16A34A', icono: 'dashboard', sources: ['api_server'] },
  { id: 'desktop', etiqueta: 'Desktop y web', color: '#8B5CF6', icono: 'desktop_windows', sources: ['desktop', 'web', 'dashboard'] },
  { id: 'cron', etiqueta: 'Tareas programadas', color: '#D97706', icono: 'schedule', sources: ['cron'] },
  { id: 'puente', etiqueta: 'Puente de Ara', color: '#DB2777', icono: 'forum', sources: ['bridge'] },
  { id: 'oneshot', etiqueta: 'Tareas de una vez', color: '#64748B', icono: 'bolt', sources: ['oneshot', 'tool'] },
  { id: 'terminal', etiqueta: 'Terminal', color: '#0D9488', icono: 'terminal', sources: ['cli', 'tui', 'local', 'codex'] },
  { id: 'otro', etiqueta: 'Otros', color: '#94A3B8', icono: 'more_horiz', sources: [] },
];

const CANAL_POR_SOURCE = new Map<string, CanalHermesId>(
  CANALES_HERMES.flatMap((c) => c.sources.map((s) => [s, c.id] as const)),
);

export function canalDeSource(source: string | null | undefined): CanalHermesId {
  return CANAL_POR_SOURCE.get(String(source ?? '').toLowerCase()) ?? 'otro';
}

export function catalogoCanal(id: CanalHermesId): CanalHermesCatalogo {
  return CANALES_HERMES.find((c) => c.id === id) ?? CANALES_HERMES[CANALES_HERMES.length - 1];
}

/** Valores de `source` que hay que pedirle a Hermes para traer un canal. */
export function sourcesDeCanal(id: CanalHermesId): string[] {
  return catalogoCanal(id).sources;
}

/** Fila cruda de /api/profiles/sessions. Solo los campos que se usan. */
export interface SesionHermesCruda {
  id?: unknown;
  source?: unknown;
  profile?: unknown;
  title?: unknown;
  preview?: unknown;
  display_name?: unknown;
  chat_id?: unknown;
  chat_type?: unknown;
  thread_id?: unknown;
  message_count?: unknown;
  last_active?: unknown;
  started_at?: unknown;
  pinned?: unknown;
  unread?: unknown;
  is_active?: unknown;
}

export interface SesionHermes {
  id: string;
  canal: CanalHermesId;
  source: string;
  perfil: string;
  perfilEtiqueta: string;
  titulo: string;
  vistaPrevia: string;
  mensajes: number;
  /** Segundos Unix de la ultima actividad, o null. */
  ultimaActividad: number | null;
  fijada: boolean;
  sinLeer: boolean;
  activa: boolean;
  /** Solo Telegram: grupo o chat privado, y topic si el grupo los usa. */
  telegram: { chatId: string; tipo: 'dm' | 'group' | 'otro'; nombre: string; topic: string | null } | null;
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const numero = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Devuelve null si la fila no trae id: sin id no se puede abrir la sesion. */
export function normalizarSesion(cruda: SesionHermesCruda): SesionHermes | null {
  const id = texto(cruda.id);
  if (!id) return null;
  const source = texto(cruda.source) || 'desconocido';
  const canal = canalDeSource(source);
  const perfil = texto(cruda.profile) || 'default';
  const vistaPrevia = texto(cruda.preview);
  const titulo = texto(cruda.title) || vistaPrevia || 'Sin titulo';

  let telegram: SesionHermes['telegram'] = null;
  if (canal === 'telegram') {
    const tipo = texto(cruda.chat_type);
    telegram = {
      chatId: texto(cruda.chat_id),
      tipo: tipo === 'dm' || tipo === 'group' ? tipo : 'otro',
      nombre: texto(cruda.display_name) || (tipo === 'dm' ? 'Chat privado' : 'Telegram'),
      topic: texto(cruda.thread_id) || null,
    };
  }

  return {
    id,
    canal,
    source,
    perfil,
    perfilEtiqueta: etiquetaPerfilHermes(perfil),
    titulo,
    vistaPrevia,
    mensajes: numero(cruda.message_count),
    ultimaActividad: numero(cruda.last_active) || numero(cruda.started_at) || null,
    fijada: cruda.pinned === true,
    sinLeer: cruda.unread === true,
    activa: cruda.is_active === true,
    telegram,
  };
}

export interface FiltroSesiones {
  canal?: CanalHermesId | null;
  perfil?: string | null;
  /** Texto libre: se busca en titulo, vista previa, grupo y perfil. */
  texto?: string | null;
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrarSesiones(sesiones: SesionHermes[], f: FiltroSesiones): SesionHermes[] {
  const q = sinAcentos(f.texto ?? '').trim();
  return sesiones.filter((s) => {
    if (f.canal && s.canal !== f.canal) return false;
    if (f.perfil && s.perfil !== f.perfil) return false;
    if (!q) return true;
    const pajar = sinAcentos(
      [s.titulo, s.vistaPrevia, s.perfilEtiqueta, s.telegram?.nombre ?? '', s.telegram?.topic ?? ''].join(' '),
    );
    return pajar.includes(q);
  });
}

export interface ConteoCanal {
  canal: CanalHermesId;
  total: number;
}

/** Cuantas sesiones hay por canal, en el orden del catalogo y sin canales vacios. */
export function contarPorCanal(sesiones: SesionHermes[]): ConteoCanal[] {
  const cuenta = new Map<CanalHermesId, number>();
  for (const s of sesiones) cuenta.set(s.canal, (cuenta.get(s.canal) ?? 0) + 1);
  return CANALES_HERMES.filter((c) => cuenta.has(c.id)).map((c) => ({ canal: c.id, total: cuenta.get(c.id) ?? 0 }));
}

export interface GrupoSesiones {
  clave: string;
  titulo: string;
  sesiones: SesionHermes[];
}

/**
 * Agrupa para mostrar: Telegram por grupo (con su topic dentro), el resto por
 * canal. Dentro de cada grupo las sesiones quedan de la mas reciente a la mas
 * vieja, con las fijadas primero.
 */
export function agruparSesiones(sesiones: SesionHermes[]): GrupoSesiones[] {
  const mapa = new Map<string, GrupoSesiones>();
  for (const s of sesiones) {
    const clave = s.telegram ? `telegram:${s.telegram.chatId}` : s.canal;
    const titulo = s.telegram ? `Telegram · ${s.telegram.nombre}` : catalogoCanal(s.canal).etiqueta;
    const grupo = mapa.get(clave) ?? { clave, titulo, sesiones: [] };
    grupo.sesiones.push(s);
    mapa.set(clave, grupo);
  }
  const orden = (a: SesionHermes, b: SesionHermes) =>
    Number(b.fijada) - Number(a.fijada) || (b.ultimaActividad ?? 0) - (a.ultimaActividad ?? 0);
  const indiceCanal = (g: GrupoSesiones) => {
    const canal = g.clave.startsWith('telegram:') ? 'telegram' : g.clave;
    return CANALES_HERMES.findIndex((c) => c.id === canal);
  };
  return [...mapa.values()]
    .map((g) => ({ ...g, sesiones: [...g.sesiones].sort(orden) }))
    .sort((a, b) => indiceCanal(a) - indiceCanal(b) || a.titulo.localeCompare(b.titulo, 'es'));
}
