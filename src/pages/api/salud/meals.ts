export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, numOrNull, hoyGuayaquil } from '../../../lib/salud/apiHelpers';
import { sumarMacros } from '../../../lib/salud/macros';

const MOMENTOS = ['desayuno', 'almuerzo', 'cena', 'snack'];

interface MealItem {
  alimento_id?: string | null;
  descripcion: string;
  cantidad_g?: number | null;
  kcal?: number | null;
  proteina_g?: number | null;
  carbos_g?: number | null;
  grasa_g?: number | null;
}

/** Normaliza y valida los items de un meal ({alimento_id?, descripcion, cantidad_g, macros...}). */
function normalizarItems(raw: unknown): MealItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      const item = it as Record<string, unknown>;
      return {
        alimento_id: typeof item.alimento_id === 'string' ? item.alimento_id : null,
        descripcion: String(item.descripcion ?? '').trim(),
        cantidad_g: numOrNull(item.cantidad_g),
        kcal: numOrNull(item.kcal),
        proteina_g: numOrNull(item.proteina_g),
        carbos_g: numOrNull(item.carbos_g),
        grasa_g: numOrNull(item.grasa_g),
      };
    })
    .filter((it) => it.descripcion);
}

/** Totales del meal a partir de sus items (macros ya vienen resueltos por item). */
function totalesDeItems(items: MealItem[]) {
  return sumarMacros(items.map((it) => ({
    kcal: it.kcal ?? 0,
    proteina_g: it.proteina_g ?? 0,
    carbos_g: it.carbos_g ?? 0,
    grasa_g: it.grasa_g ?? 0,
  })));
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  try {
    const sb = getSupabaseServer();
    if (id) {
      const { data, error } = await sb.from('nutricion_meals').select('*').eq('id', id).single();
      if (error) throw error;
      return json({ meal: data });
    }
    const q = context.url.searchParams.get('q')?.trim() || '';
    let query = sb.from('nutricion_meals').select('*').order('nombre', { ascending: true });
    if (q) query = query.ilike('nombre', `%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return json({ meals: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();

    // Rama de registro: POST { log: meal_id, fecha?, momento } -> N filas en comidas_log.
    if (body.log) {
      const momento = body.momento?.trim() || 'snack';
      if (!MOMENTOS.includes(momento)) {
        return json({ error: `momento debe ser uno de: ${MOMENTOS.join(', ')}` }, 400);
      }
      const { data: meal, error } = await sb
        .from('nutricion_meals')
        .select('*')
        .eq('id', body.log)
        .single();
      if (error) throw error;

      const items: MealItem[] = Array.isArray(meal.items) ? meal.items : [];
      if (!items.length) return json({ error: 'el meal no tiene items' }, 400);

      const fecha = body.fecha?.trim() || hoyGuayaquil();
      const filas = items.map((it) => ({
        fecha,
        momento,
        alimento_id: it.alimento_id || null,
        descripcion_libre: it.descripcion,
        cantidad_g: it.cantidad_g ?? null,
        kcal: it.kcal ?? null,
        proteina_g: it.proteina_g ?? null,
        carbos_g: it.carbos_g ?? null,
        grasa_g: it.grasa_g ?? null,
        source: 'manual',
        tipo_dia: 'normal',
      }));

      const { data: logs, error: errLog } = await sb.from('comidas_log').insert(filas).select();
      if (errLog) throw errLog;

      // Fire-and-forget: incrementa veces_usado del meal (no bloquea la respuesta).
      sb.from('nutricion_meals')
        .update({ veces_usado: (meal.veces_usado ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', meal.id)
        .then(() => null)
        .catch(() => null);

      return json({ comidas: logs ?? [], meal_id: meal.id }, 201);
    }

    // Rama normal: crear meal reusable.
    if (!body.nombre?.trim()) return json({ error: 'nombre requerido' }, 400);
    const items = normalizarItems(body.items);
    if (!items.length) return json({ error: 'items requerido (al menos 1)' }, 400);
    const totales = totalesDeItems(items);

    const { data, error } = await sb
      .from('nutricion_meals')
      .insert([{
        nombre: body.nombre.trim(),
        items,
        kcal: totales.kcal,
        proteina_g: totales.proteina_g,
        carbos_g: totales.carbos_g,
        grasa_g: totales.grasa_g,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ meal: data }, 201);
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
    if ('nombre' in body) patch.nombre = String(body.nombre ?? '').trim();
    if ('items' in body) {
      const items = normalizarItems(body.items);
      const totales = totalesDeItems(items);
      patch.items = items;
      patch.kcal = totales.kcal;
      patch.proteina_g = totales.proteina_g;
      patch.carbos_g = totales.carbos_g;
      patch.grasa_g = totales.grasa_g;
    }
    const sb = getSupabaseServer();
    const { data, error } = await sb.from('nutricion_meals').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ meal: data });
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
    const { error } = await sb.from('nutricion_meals').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
