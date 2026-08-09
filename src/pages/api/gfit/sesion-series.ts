export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, numOrNull } from '../../../lib/salud/apiHelpers';
import { pesoDesdeInput, type UnidadPeso } from '../../../lib/gfit/unidades';

// Molde A (mismo patrÃ³n que api/os/gfit/series.ts, pero sobre gfit_sesion_series:
// el registro REAL de series ejecutadas en una sesiÃ³n, no el plan de la rutina).
const TIPOS = ['warmup', 'working', 'drop', 'failure'];

// Acepta peso_kg directo (ya canÃ³nico) o {peso, unidad} en la unidad preferida del
// usuario, convertido aquÃ­ a peso_kg canÃ³nico. Nunca se guarda en libras.
function resolverPesoKg(body: Record<string, unknown>): number | null | undefined {
  if ('peso_kg' in body) return numOrNull(body.peso_kg);
  if ('peso' in body) {
    const unidad: UnidadPeso = body.unidad === 'lb' ? 'lb' : 'kg';
    const peso = numOrNull(body.peso);
    return peso == null ? null : pesoDesdeInput(peso, unidad);
  }
  return undefined; // no se enviÃ³ peso: no tocar el campo (PATCH) / null (POST)
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  try {
    const sesionId = url.searchParams.get('sesion_id');
    if (!sesionId) return json({ error: 'sesion_id requerido' }, 400);
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('gfit_sesion_series')
      .select('*, ejercicio:ejercicios_catalogo(slug,nombre_en,nombre_es,musculos_primarios,patron)')
      .eq('sesion_id', sesionId)
      .order('orden', { ascending: true });
    if (error) throw error;
    return json({ series: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    if (!body.sesion_id) return json({ error: 'sesion_id requerido' }, 400);
    if (!body.ejercicio_id) return json({ error: 'ejercicio_id requerido' }, 400);
    const tipo = TIPOS.includes(body.tipo) ? body.tipo : 'working';

    const sb = getSupabaseServer();
    const { count, error: errCount } = await sb
      .from('gfit_sesion_series')
      .select('id', { count: 'exact', head: true })
      .eq('sesion_id', body.sesion_id);
    if (errCount) throw errCount;
    const orden = typeof body.orden === 'number' ? body.orden : (count ?? 0);

    const pesoKg = resolverPesoKg(body);
    const { data, error } = await sb
      .from('gfit_sesion_series')
      .insert([{
        sesion_id: body.sesion_id,
        dia_ejercicio_id: body.dia_ejercicio_id || null,
        ejercicio_id: body.ejercicio_id,
        orden,
        tipo,
        peso_kg: pesoKg ?? null,
        reps: numOrNull(body.reps),
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, serie: data }, 201);
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
    const patch: Record<string, unknown> = {};
    if ('tipo' in body) {
      if (!TIPOS.includes(body.tipo)) return json({ error: 'tipo invÃ¡lido' }, 400);
      patch.tipo = body.tipo;
    }
    if ('orden' in body) patch.orden = numOrNull(body.orden) ?? 0;
    if ('reps' in body) patch.reps = numOrNull(body.reps);
    if ('dia_ejercicio_id' in body) patch.dia_ejercicio_id = body.dia_ejercicio_id || null;
    const pesoKg = resolverPesoKg(body);
    if (pesoKg !== undefined) patch.peso_kg = pesoKg;

    const sb = getSupabaseServer();
    const { data, error } = await sb.from('gfit_sesion_series').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ ok: true, serie: data });
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
    const { error } = await sb.from('gfit_sesion_series').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
