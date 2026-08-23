// Logica de /api/salud/sueno/config, portada de
// src/pages/api/salud/sueno/config.ts.
//
// Fila unica (id = 1) con los parametros personales del modelo de dos procesos.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';
import { numOrNull } from '../lib/salud/apiHelpers.ts';
import { NECESIDAD_MAX_H, NECESIDAD_MIN_H } from '../lib/sueno/deuda.ts';

async function leerOCrear(sb: SupabaseClient) {
  const { data, error } = await sb.from('sueno_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: creada, error: errCrear } = await sb
    .from('sueno_config')
    .upsert({ id: 1 }, { onConflict: 'id' })
    .select()
    .single();
  if (errCrear) throw errCrear;
  return creada;
}

/** HH:MM o HH:MM:SS. Se guarda normalizado a HH:MM:00. */
function horaValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/);
  return m ? `${m[1]}:${m[2]}:00` : null;
}

export async function leerConfigSueno() {
  return leerOCrear(getSupabaseServer());
}

export async function actualizarConfigSueno(body: Record<string, any>) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.necesidad_h !== undefined) {
    const n = numOrNull(body.necesidad_h);
    if (n === null || n < NECESIDAD_MIN_H - 2 || n > NECESIDAD_MAX_H + 2) {
      throw error400(`necesidad_h debe estar entre ${NECESIDAD_MIN_H - 2} y ${NECESIDAD_MAX_H + 2}`);
    }
    patch.necesidad_h = n;
  }
  if (body.necesidad_auto !== undefined) patch.necesidad_auto = body.necesidad_auto === true || body.necesidad_auto === 'true';
  if (body.siestas_ok !== undefined) patch.siestas_ok = body.siestas_ok === true || body.siestas_ok === 'true';

  for (const campo of ['hora_dormir', 'hora_despertar'] as const) {
    if (body[campo] !== undefined) {
      const h = horaValida(body[campo]);
      if (!h) throw error400(`${campo} debe tener formato HH:MM`);
      patch[campo] = h;
    }
  }

  if (body.deuda_objetivo_h !== undefined) {
    const n = numOrNull(body.deuda_objetivo_h);
    if (n === null || n < 0 || n > 10) throw error400('deuda_objetivo_h debe estar entre 0 y 10');
    patch.deuda_objetivo_h = n;
  }
  if (body.cafeina_vida_media_h !== undefined) {
    const n = numOrNull(body.cafeina_vida_media_h);
    if (n === null || n < 1 || n > 12) throw error400('cafeina_vida_media_h debe estar entre 1 y 12');
    patch.cafeina_vida_media_h = n;
  }
  if (body.cafeina_umbral_mg !== undefined) {
    const n = numOrNull(body.cafeina_umbral_mg);
    if (n === null || n < 0 || n > 400) throw error400('cafeina_umbral_mg debe estar entre 0 y 400');
    patch.cafeina_umbral_mg = Math.round(n);
  }

  const sb = getSupabaseServer();
  await leerOCrear(sb);
  const { data, error } = await sb.from('sueno_config').update(patch).eq('id', 1).select().single();
  if (error) throw error;
  return data;
}
