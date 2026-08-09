export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../../lib/supabase';
import { isOsAuthorized, json } from '../../../../os/lib/osAuth';
import { errMsg, hoyGuayaquil, isExternalTokenAuthorized } from '../../../../lib/salud/apiHelpers';
import { restarDias } from '../../../../lib/sueno/deuda';

// Sesiones de sueno con horarios reales. Contrato completo (incluido el flujo
// n8n / Google Health) en apps/web/docs/sueno-dos-procesos.md.

const DIAS_DEFAULT = 30;
const TZ = 'America/Guayaquil';

interface SesionEntrada {
  inicio?: unknown;
  fin?: unknown;
  fecha?: unknown;
  minutos?: unknown;
  siesta?: unknown;
  calidad?: unknown;
  fuente?: unknown;
  notas?: unknown;
  raw?: unknown;
}

/** Dia local (America/Guayaquil) de un instante. */
function fechaLocal(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });
}

function construirPayload(s: SesionEntrada): { error: string } | { payload: Record<string, unknown> } {
  if (typeof s.inicio !== 'string' || typeof s.fin !== 'string') {
    return { error: 'inicio y fin son obligatorios (ISO 8601)' };
  }
  const inicioMs = Date.parse(s.inicio);
  const finMs = Date.parse(s.fin);
  if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs)) return { error: 'inicio o fin no son fechas validas' };
  if (finMs <= inicioMs) return { error: 'fin debe ser posterior a inicio' };

  const durMin = Math.round((finMs - inicioMs) / 60_000);
  if (durMin > 1440) return { error: 'la sesion no puede durar mas de 24 h' };

  let minutos = durMin;
  if (s.minutos !== undefined && s.minutos !== null && s.minutos !== '') {
    const n = Number(s.minutos);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return { error: 'minutos debe ser un entero positivo' };
    if (n > durMin) return { error: 'minutos dormidos no puede superar la duracion de la sesion' };
    minutos = n;
  }

  let calidad: number | null = null;
  if (s.calidad !== undefined && s.calidad !== null && s.calidad !== '') {
    const n = Number(s.calidad);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { error: 'calidad debe ser un entero de 1 a 5' };
    calidad = n;
  }

  // El sueno se acredita al dia en que se DESPIERTA: dormirse el 5 a las 23:00
  // y despertar el 6 acredita la noche al 6, que es el dia que se vive con ella.
  const fecha = typeof s.fecha === 'string' && s.fecha.trim() ? s.fecha.trim() : fechaLocal(finMs);

  return {
    payload: {
      fecha,
      inicio: new Date(inicioMs).toISOString(),
      fin: new Date(finMs).toISOString(),
      minutos,
      siesta: s.siesta === true || s.siesta === 'true',
      calidad,
      fuente: typeof s.fuente === 'string' && s.fuente.trim() ? s.fuente.trim() : 'manual',
      notas: typeof s.notas === 'string' && s.notas.trim() ? s.notas.trim() : null,
      // Siempre presente: un upsert en batch exige las mismas claves en todos los
      // elementos (PostgREST), y aqui el upsert reemplaza la fila completa.
      raw: s.raw ?? null,
      updated_at: new Date().toISOString(),
    },
  };
}

// GET ?desde=&hasta= (default ultimos 30 dias) -> { sesiones }
export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const { searchParams } = context.url;
    const hasta = searchParams.get('hasta') || hoyGuayaquil();
    const desde = searchParams.get('desde') || restarDias(hasta, DIAS_DEFAULT - 1);

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('sueno_sesiones')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('inicio', { ascending: false });
    if (error) throw error;
    return json({ sesiones: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// POST: una sesion o un batch { sesiones: [...] }. Upsert por `inicio`, asi que
// el sync externo puede reintentar sin duplicar.
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();
    const entradas: SesionEntrada[] = Array.isArray(body?.sesiones) ? body.sesiones : [body ?? {}];
    if (!entradas.length) return json({ error: 'sesiones no puede estar vacio' }, 400);

    const payloads: Record<string, unknown>[] = [];
    for (const entrada of entradas) {
      const r = construirPayload(entrada ?? {});
      if ('error' in r) return json({ error: r.error }, 400);
      payloads.push(r.payload);
    }

    const { data, error } = await sb
      .from('sueno_sesiones')
      .upsert(payloads, { onConflict: 'inicio' })
      .select();
    if (error) throw error;

    if (Array.isArray(body?.sesiones)) return json({ sesiones: data ?? [], n: data?.length ?? 0 });
    return json({ sesion: data?.[0] ?? null });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// DELETE ?id=
export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('sueno_sesiones').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
