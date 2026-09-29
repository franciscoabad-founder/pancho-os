// Lista de sesiones de Hermes para el OS (Fase 2, 29-sep-2026).
//
// El OS de produccion corre en el mismo VPS que Hermes. Para leer las sesiones
// (de todos los perfiles y canales) le pregunta al servicio hermes-ui, que ya
// tiene la sesion del dashboard iniciada del lado del servidor: asi el OS no
// guarda ninguna clave nueva de Hermes. Solo se hacen lecturas (GET).
//
// hermes-ui escucha solo en Tailscale (decision 1b = A), y esta ruta del OS
// exige la sesion del OS, igual que el resto de /api. Si hermes-ui no responde
// el error es explicito: nunca se inventa una lista.

import { readEnv } from '../lib/env.ts';
import {
  normalizarSesion,
  sourcesDeCanal,
  type CanalHermesId,
  type SesionHermes,
  type SesionHermesCruda,
} from '../os/lib/canalesHermes.ts';

const BASE_POR_DEFECTO = 'http://100.127.42.51:9120';
const TIMEOUT_MS = 20_000;
/** Tope de Hermes por pagina (le=500 en /api/profiles/sessions). */
export const MAX_POR_PAGINA = 500;

export interface ParametrosSesiones {
  perfil?: string | null;
  canal?: CanalHermesId | null;
  limite?: number;
  desplazamiento?: number;
}

export interface ResultadoSesiones {
  sesiones: SesionHermes[];
  /** Total que hay en Hermes con el filtro pedido (no solo los devueltos). */
  total: number;
  totalPorPerfil: Record<string, number>;
  /** Perfiles cuya base de datos no se pudo leer. */
  errores: { profile: string; error: string }[];
}

type Fetcher = typeof fetch;
let fetcher: Fetcher = (...args) => fetch(...args);

/** Solo para pruebas. */
export function setFetcherSesiones(fn: Fetcher | null): void {
  fetcher = fn ?? ((...args) => fetch(...args));
}

const enteroAcotado = (v: unknown, defecto: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : defecto;
};

/** Arma la ruta de Hermes. Perfil y canal solo aceptan caracteres simples. */
export function construirRutaSesiones(p: ParametrosSesiones): string {
  const q = new URLSearchParams();
  q.set('limit', String(enteroAcotado(p.limite, 200, 1, MAX_POR_PAGINA)));
  q.set('offset', String(enteroAcotado(p.desplazamiento, 0, 0, 100_000)));
  q.set('min_messages', '0');
  q.set('archived', 'exclude');
  q.set('order', 'recent');
  if (p.perfil && /^[a-z0-9][a-z0-9_-]{0,40}$/i.test(p.perfil)) q.set('profile', p.perfil);
  const sources = p.canal ? sourcesDeCanal(p.canal) : [];
  if (sources.length) q.set('sources', sources.join(','));
  return `/hermes-api/api/profiles/sessions?${q.toString()}`;
}

export async function listarSesionesHermes(p: ParametrosSesiones = {}): Promise<ResultadoSesiones> {
  const base = (readEnv('HERMES_UI_INTERNAL_URL') ?? BASE_POR_DEFECTO).replace(/\/+$/, '');
  const url = `${base}${construirRutaSesiones(p)}`;

  let res: Response;
  try {
    res = await fetcher(url, { method: 'GET', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`hermes-ui no responde: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new Error(`hermes-ui respondio HTTP ${res.status}`);

  const cuerpo = (await res.json()) as {
    sessions?: SesionHermesCruda[];
    total?: number;
    profile_totals?: Record<string, number>;
    errors?: { profile?: string; error?: string }[];
  };
  if (!Array.isArray(cuerpo.sessions)) throw new Error('hermes-ui devolvio una respuesta sin sesiones');

  const sesiones = cuerpo.sessions.map(normalizarSesion).filter((s): s is SesionHermes => s !== null);
  return {
    sesiones,
    total: typeof cuerpo.total === 'number' ? cuerpo.total : sesiones.length,
    totalPorPerfil: cuerpo.profile_totals ?? {},
    errores: (cuerpo.errors ?? []).map((e) => ({ profile: String(e.profile ?? ''), error: String(e.error ?? '') })),
  };
}
