// Proxy server-side hacia la app de Cortex (app-cortex.franciscoabad.com).
//
// Extraido de src/pages/api/cortex-admin.ts y src/pages/api/cortex-invitar.ts
// (Astro) sin cambios de comportamiento. El unico secreto que toca es
// CORTEX_ADMIN_TOKEN, que nunca sale del servidor.

import { readEnv } from '../lib/env.ts';

const CORTEX_URL_POR_DEFECTO = 'https://app-cortex.franciscoabad.com';

// El overview es rapido; el alta de tester provisiona un tenant entero y puede
// tardar minutos, de ahi la diferencia de timeouts.
const TIMEOUT_OVERVIEW_MS = 30_000;
const TIMEOUT_INVITAR_MS = 180_000;

/** Respuesta cruda de Cortex: cuerpo ya parseado y su status HTTP. */
export interface RespuestaCortex {
  data: unknown;
  status: number;
}

function credenciales(): { adminToken: string; baseUrl: string } {
  const adminToken = readEnv('CORTEX_ADMIN_TOKEN');
  if (!adminToken) throw new Error('CORTEX_ADMIN_TOKEN no configurado');
  return {
    adminToken,
    baseUrl: readEnv('CORTEX_APP_URL') || CORTEX_URL_POR_DEFECTO,
  };
}

export async function obtenerOverviewCortex(): Promise<RespuestaCortex> {
  const { adminToken, baseUrl } = credenciales();
  const res = await fetch(`${baseUrl}/api/admin/overview`, {
    method: 'GET',
    headers: { 'X-Cortex-Admin-Token': adminToken },
    signal: AbortSignal.timeout(TIMEOUT_OVERVIEW_MS),
  });
  return { data: await res.json(), status: res.status };
}

export interface InvitacionCortex {
  nombre: string;
  email: string;
  empresa?: string;
  rol?: string;
  telefono?: string;
  tz?: string;
  objetivo?: string;
  consentimiento_datos: true;
}

/**
 * Valida el cuerpo del alta de tester. Lanza Error con el mensaje exacto que
 * la version Astro devolvia con status 400.
 */
export function validarInvitacion(body: Record<string, unknown>): InvitacionCortex {
  const nombre = (body.nombre ?? '').toString().trim();
  const email = (body.email ?? '').toString().trim();
  const consentimiento = body.consentimiento_datos === true;

  if (!nombre) throw new Error('nombre requerido');
  if (!email) throw new Error('email requerido');
  if (!consentimiento) throw new Error('consentimiento_datos requerido');

  const opcional = (v: unknown) => (v ? String(v).trim() : undefined);

  return {
    nombre,
    email,
    empresa: opcional(body.empresa),
    rol: opcional(body.rol),
    telefono: opcional(body.telefono),
    tz: opcional(body.tz),
    objetivo: opcional(body.objetivo),
    consentimiento_datos: true,
  };
}

export async function invitarTesterCortex(payload: InvitacionCortex): Promise<RespuestaCortex> {
  const { adminToken, baseUrl } = credenciales();
  const res = await fetch(`${baseUrl}/api/invitar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cortex-Admin-Token': adminToken,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_INVITAR_MS),
  });
  return { data: await res.json(), status: res.status };
}
