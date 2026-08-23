// Logica de /api/salud/meals, portada de src/pages/api/salud/meals.ts.
// Meals reusables (combos de alimentos) y su registro en bloque a comidas_log.

import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';
import { numOrNull, hoyGuayaquil } from '../lib/salud/apiHelpers.ts';
import { sumarMacros } from '../lib/salud/macros.ts';

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

export async function leerMeals(params: { id: string | null; q: string }) {
  const sb = getSupabaseServer();
  if (params.id) {
    const { data, error } = await sb.from('nutricion_meals').select('*').eq('id', params.id).single();
    if (error) throw error;
    return { meal: data };
  }
  let query = sb.from('nutricion_meals').select('*').order('nombre', { ascending: true });
  if (params.q) query = query.ilike('nombre', `%${params.q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return { meals: data ?? [] };
}

/** POST { log: meal_id, fecha?, momento } -> N filas en comidas_log. */
export async function registrarMeal(body: Record<string, any>) {
  const sb = getSupabaseServer();
  const momento = body.momento?.trim() || 'snack';
  if (!MOMENTOS.includes(momento)) {
    throw error400(`momento debe ser uno de: ${MOMENTOS.join(', ')}`);
  }
  const { data: meal, error } = await sb
    .from('nutricion_meals')
    .select('*')
    .eq('id', body.log)
    .single();
  if (error) throw error;

  const items: MealItem[] = Array.isArray(meal.items) ? meal.items : [];
  if (!items.length) throw error400('el meal no tiene items');

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

  return { comidas: logs ?? [], meal_id: meal.id };
}

export async function crearMeal(body: Record<string, any>) {
  if (!body.nombre?.trim()) throw error400('nombre requerido');
  const items = normalizarItems(body.items);
  if (!items.length) throw error400('items requerido (al menos 1)');
  const totales = totalesDeItems(items);

  const sb = getSupabaseServer();
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
  return data;
}

export async function actualizarMeal(id: string, body: Record<string, any>) {
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
  return data;
}

export async function eliminarMeal(id: string): Promise<void> {
  const sb = getSupabaseServer();
  const { error } = await sb.from('nutricion_meals').delete().eq('id', id);
  if (error) throw error;
}
