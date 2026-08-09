export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, numOrNull } from '../../../lib/salud/apiHelpers';
import { pesoDesdeInput, type UnidadPeso } from '../../../lib/gfit/unidades';

const TIPOS = ['warmup', 'working', 'drop', 'failure'];

// Acepta peso_kg directo (ya canÃ³nico) o {peso, unidad} en la unidad preferida
// del usuario, convertido aquÃ­ a peso_kg canÃ³nico. Nunca se guarda en libras.
function resolverPesoKg(body: Record<string, unknown>): number | null | undefined {
  if ('peso_kg' in body) return numOrNull(body.peso_kg);
  if ('peso' in body) {
    const unidad: UnidadPeso = body.unidad === 'lb' ? 'lb' : 'kg';
    const peso = numOrNull(body.peso);
    return peso == null ? null : pesoDesdeInput(peso, unidad);
  }
  return undefined; // no se enviÃ³ peso: no tocar el campo (PATCH) / null (POST)
}

async function reordenar(sb: ReturnType<typeof getSupabaseServer>, items: unknown) {
  if (!Array.isArray(items)) throw new Error('reordenar requiere un array');
  await Promise.all(
    items.map((it: any) => {
      if (!it?.id) return Promise.resolve();
      return sb.from('gfit_series_plan').update({ orden: Number(it.orden) || 0 }).eq('id', it.id);
    }),
  );
}

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();

    if ('reordenar' in body) {
      await reordenar(sb, body.reordenar);
      return json({ ok: true });
    }

    if (!body.dia_ejercicio_id) return json({ error: 'dia_ejercicio_id requerido' }, 400);
    const tipo = TIPOS.includes(body.tipo) ? body.tipo : 'working';

    const { count, error: errCount } = await sb
      .from('gfit_series_plan')
      .select('id', { count: 'exact', head: true })
      .eq('dia_ejercicio_id', body.dia_ejercicio_id);
    if (errCount) throw errCount;
    const orden = typeof body.orden === 'number' ? body.orden : (count ?? 0);

    const pesoKg = resolverPesoKg(body);
    const { data, error } = await sb
      .from('gfit_series_plan')
      .insert([{
        dia_ejercicio_id: body.dia_ejercicio_id,
        orden,
        tipo,
        peso_kg: pesoKg ?? null,
        reps: numOrNull(body.reps),
        descanso_s: numOrNull(body.descanso_s),
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
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('tipo' in body) {
      if (!TIPOS.includes(body.tipo)) return json({ error: 'tipo invÃ¡lido' }, 400);
      patch.tipo = body.tipo;
    }
    if ('orden' in body) patch.orden = numOrNull(body.orden) ?? 0;
    if ('reps' in body) patch.reps = numOrNull(body.reps);
    if ('descanso_s' in body) patch.descanso_s = numOrNull(body.descanso_s);
    const pesoKg = resolverPesoKg(body);
    if (pesoKg !== undefined) patch.peso_kg = pesoKg;

    const sb = getSupabaseServer();
    const { data, error } = await sb.from('gfit_series_plan').update(patch).eq('id', id).select().single();
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
    const { error } = await sb.from('gfit_series_plan').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
