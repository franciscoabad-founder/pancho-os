// Skills de Hermes para el OS (Fase 4). Lee y activa/desactiva skills a traves
// de hermes-ui (mismo VPS, sesion del dashboard del lado del servidor).
//
// Activar o desactivar cambia la configuracion real de Hermes en el VPS
// (PUT /api/skills/toggle), asi que: el nombre y el perfil se validan, solo se
// acepta un booleano, y la ruta que llama a esto exige la sesion del OS.

import { readEnv } from '../lib/env.ts';
import {
  NOMBRE_SKILL,
  normalizarSkill,
  type SkillHermes,
  type SkillHermesCruda,
} from '../os/lib/skillsHermes.ts';

const BASE_POR_DEFECTO = 'http://100.127.42.51:9120';
const TIMEOUT_MS = 20_000;
const PERFIL = /^[a-z0-9][a-z0-9_-]{0,40}$/i;

type Fetcher = typeof fetch;
let fetcher: Fetcher = (...args) => fetch(...args);

/** Solo para pruebas. */
export function setFetcherSkills(fn: Fetcher | null): void {
  fetcher = fn ?? ((...args) => fetch(...args));
}

const base = () => (readEnv('HERMES_UI_INTERNAL_URL') ?? BASE_POR_DEFECTO).replace(/\/+$/, '');

function rutaSkills(ruta: string, perfil?: string | null): string {
  const q = perfil && PERFIL.test(perfil) && perfil !== 'default' ? `?profile=${encodeURIComponent(perfil)}` : '';
  return `${base()}/hermes-api${ruta}${q}`;
}

async function pedir(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`hermes-ui no responde: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new Error(`hermes-ui respondio HTTP ${res.status}`);
  return res;
}

export async function listarSkills(perfil?: string | null): Promise<SkillHermes[]> {
  const res = await pedir(rutaSkills('/api/skills', perfil), { method: 'GET' });
  const cuerpo = (await res.json()) as SkillHermesCruda[] | { skills?: SkillHermesCruda[] };
  const filas = Array.isArray(cuerpo) ? cuerpo : cuerpo.skills;
  if (!Array.isArray(filas)) throw new Error('hermes-ui devolvio una respuesta sin skills');
  return filas
    .map(normalizarSkill)
    .filter((s): s is SkillHermes => s !== null)
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Activa o desactiva una skill. Devuelve el estado que Hermes confirma. */
export async function cambiarSkill(nombre: unknown, activa: unknown, perfil?: unknown): Promise<{ nombre: string; activa: boolean }> {
  if (typeof nombre !== 'string' || !NOMBRE_SKILL.test(nombre)) throw new Error('nombre de skill invalido');
  if (typeof activa !== 'boolean') throw new Error('activa debe ser verdadero o falso');
  // Esto cambia la config real de Hermes: un perfil mal escrito no puede caer en
  // silencio al perfil default y tocar las skills de Alfred.
  if (perfil !== undefined && perfil !== null && (typeof perfil !== 'string' || !PERFIL.test(perfil))) {
    throw new Error('perfil invalido');
  }
  const res = await pedir(rutaSkills('/api/skills/toggle', perfil), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: nombre, enabled: activa }),
  });
  const cuerpo = (await res.json()) as { ok?: boolean; name?: string; enabled?: boolean };
  if (cuerpo.ok !== true) throw new Error('Hermes no confirmo el cambio');
  return { nombre: cuerpo.name ?? nombre, activa: cuerpo.enabled === true };
}
