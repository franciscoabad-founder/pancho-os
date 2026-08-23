export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, numOrNull, hoyGuayaquil, isExternalTokenAuthorized } from '../../../lib/salud/apiHelpers';
import { registrarEvento } from '../../../lib/juego/motor';

// OVERLAP DE PESO CORPORAL: peso_kg vive tambien en biometricas_dia
// (/api/biometricas, espejo diario de Google Health via n8n). Regla de lectura
// acordada: cuerpo_log manda, biometricas_dia rellena los dias sin medicion
// propia. Igual criterio que el sueno en src/lib/sueno/estado.ts.
// La regla ya esta implementada y testeada en src/lib/salud/peso.ts. Este
// endpoint NO la aplica todavia a proposito: sigue sin portar a TanStack y el
// arbol src/pages/ no corre en esta rama. Al portarlo a src/routes/api/,
// cablear pesoDelDia/ultimoPesoConocido/serieDePeso en el GET (receta al pie
// de peso.ts). El modelo de escritura de esta tabla no cambia.
const SOURCES = ['manual', 'renpho', 'fitbit'];

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('cuerpo_log')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(365);
    if (error) throw error;
    return json({ mediciones: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  // Acepta escritura externa (balanza Renpho / Fitbit vía n8n) con header X-OS-Token.
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const body = await context.request.json();
    const source = body.source?.trim() || 'manual';
    if (!SOURCES.includes(source)) return json({ error: `source debe ser: ${SOURCES.join(', ')}` }, 400);
    // Cualquier medición cuenta, incluido solo sueño (alimenta la regla de recuperación).
    const MEDICIONES = ['peso_kg', 'grasa_pct', 'musculo_kg', 'agua_pct', 'cintura_cm', 'sueno_horas'];
    if (MEDICIONES.every((f) => numOrNull(body[f]) == null)) {
      return json({ error: 'al menos una medición requerida' }, 400);
    }
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('cuerpo_log')
      .insert([{
        fecha: body.fecha?.trim() || hoyGuayaquil(),
        peso_kg: numOrNull(body.peso_kg),
        grasa_pct: numOrNull(body.grasa_pct),
        musculo_kg: numOrNull(body.musculo_kg),
        agua_pct: numOrNull(body.agua_pct),
        cintura_cm: numOrNull(body.cintura_cm),
        sueno_horas: numOrNull(body.sueno_horas),
        source,
        notas: body.notas?.trim() || null,
      }])
      .select()
      .single();
    if (error) throw error;
    registrarEvento(sb, { tipo: 'registro_cuerpo', ref_tabla: 'cuerpo_log', ref_id: data.id }).catch(() => null);
    return json({ medicion: data }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const body = await context.request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const c of ['peso_kg', 'grasa_pct', 'musculo_kg', 'agua_pct', 'cintura_cm', 'sueno_horas']) {
      if (c in body) patch[c] = numOrNull(body[c]);
    }
    for (const c of ['fecha', 'notas']) if (c in body) patch[c] = body[c]?.trim?.() || null;
    const sb = getSupabaseServer();
    const { data, error } = await sb.from('cuerpo_log').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ medicion: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('cuerpo_log').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
