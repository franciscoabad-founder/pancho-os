// Logica de /api/salud/comidas-log, portada de
// src/pages/api/salud/comidas-log.ts. Bitacora de nutricion: registro por
// alimento (gramos o porcion), por descripcion libre o con macros directos.

import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';
import { numOrNull, hoyGuayaquil } from '../lib/salud/apiHelpers.ts';
import { calcularMacros, sumarMacros, r1 } from '../lib/salud/macros.ts';
import { gramosDesdePorcion } from '../lib/salud/porciones.ts';
import { registrarEvento } from '../lib/juego/motor.ts';
import { hoyLocal } from '../lib/habitos/fechas.ts';

const MOMENTOS = ['desayuno', 'almuerzo', 'cena', 'snack'];
const TIPOS_DIA = ['normal', 'leg_day', 'refeed', 'keto_light', 'keto'];
const SOURCES = ['manual', 'telegram', 'agente'];

// Micro-nutrientes por 100 g que se snapshotean al registrar (mismas columnas en
// alimentos y comidas_log, ver 20260720000000_nutricion_yazio.sql).
const MICROS = ['azucares_g', 'saturada_g', 'monoinsaturada_g', 'poliinsaturada_g', 'sodio_mg', 'colesterol_mg'] as const;

// Escala un valor por 100 g a la cantidad de gramos consumida (mismo redondeo que
// calcularMacros, vía r1).
function escalarMicro(valorPor100g: unknown, gramos: number): number | null {
  const v = numOrNull(valorPor100g);
  if (v == null) return null;
  const g = Number.isFinite(gramos) && gramos > 0 ? gramos : 0;
  return r1(v * (g / 100));
}

/**
 * Resuelve los macros (+ micros) y los gramos finales de una entrada. Acepta tres
 * formas de indicar la cantidad, en este orden de prioridad:
 *   1. alimento_id + cantidad_g (gramos directos).
 *   2. alimento_id + porcion_id + cantidad (multiplicador de una alimento_porciones).
 *   3. Macros directos (descripcion_libre o captura externa con macros ya estimados).
 * Devuelve tambien `cantidad_g` con los gramos resueltos, para que el caller pueda
 * persistir la cantidad real (relevante en el caso 2, donde no vino en el body).
 */
async function resolverMacros(body: Record<string, any>) {
  let cantidadG = numOrNull(body.cantidad_g);
  const porcionId = typeof body.porcion_id === 'string' ? body.porcion_id : null;
  const cantidadPorcion = numOrNull(body.cantidad);

  if (body.alimento_id && cantidadG == null && porcionId && cantidadPorcion != null) {
    const sb = getSupabaseServer();
    const { data: porcion, error } = await sb
      .from('alimento_porciones')
      .select('nombre,gramos')
      .eq('id', porcionId)
      .single();
    if (error) throw error;
    cantidadG = gramosDesdePorcion(porcion, cantidadPorcion);
  }

  if (body.alimento_id && cantidadG != null) {
    const sb = getSupabaseServer();
    const { data: alimento, error } = await sb
      .from('alimentos')
      .select(`kcal,proteina_g,carbos_g,grasa_g,fibra_g,${MICROS.join(',')}`)
      .eq('id', body.alimento_id)
      .single();
    if (error) throw error;
    const macros = calcularMacros(alimento, cantidadG);
    const micros: Record<string, number | null> = {};
    for (const c of MICROS) micros[c] = escalarMicro((alimento as Record<string, unknown>)[c], cantidadG);
    return { ...macros, ...micros, cantidad_g: cantidadG };
  }

  // Macros directos (descripcion_libre o captura externa con macros ya estimados).
  const micros: Record<string, number | null> = {};
  for (const c of MICROS) micros[c] = numOrNull(body[c]);
  return {
    kcal: numOrNull(body.kcal),
    proteina_g: numOrNull(body.proteina_g),
    carbos_g: numOrNull(body.carbos_g),
    grasa_g: numOrNull(body.grasa_g),
    fibra_g: numOrNull(body.fibra_g),
    ...micros,
    cantidad_g: cantidadG,
  };
}

export async function leerComidas(params: {
  historial: boolean;
  desde: string | null;
  dia: string | null;
}): Promise<Record<string, unknown>> {
  const sb = getSupabaseServer();

  // Historial: agrupado por fecha con totales.
  if (params.historial) {
    let q = sb.from('comidas_log').select('*').order('fecha', { ascending: false });
    if (params.desde) q = q.gte('fecha', params.desde);
    const { data, error } = await q;
    if (error) throw error;
    return { comidas: data ?? [] };
  }

  const dia = params.dia || hoyGuayaquil();
  const { data, error } = await sb
    .from('comidas_log')
    .select('*')
    .eq('fecha', dia)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const entradas = data ?? [];
  const totales = sumarMacros(entradas);
  const tipo_dia = entradas.find((e) => e.tipo_dia)?.tipo_dia || 'normal';

  // Targets del día: salud_config es singleton (una sola fila por convención).
  const { data: config } = await sb
    .from('salud_config')
    .select('kcal_objetivo,proteina_objetivo_g,carbos_objetivo_g,grasa_objetivo_g')
    .limit(1)
    .maybeSingle();
  const targets = {
    kcal: config?.kcal_objetivo ?? null,
    proteina_g: config?.proteina_objetivo_g ?? null,
    carbos_g: config?.carbos_objetivo_g ?? null,
    grasa_g: config?.grasa_objetivo_g ?? null,
  };
  // Restante null-safe: si no hay target configurado para un macro, no se puede
  // calcular cuanto falta (no se asume 0).
  const restante = {
    kcal: targets.kcal == null ? null : r1(targets.kcal - totales.kcal),
    proteina_g: targets.proteina_g == null ? null : r1(targets.proteina_g - totales.proteina_g),
    carbos_g: targets.carbos_g == null ? null : r1(targets.carbos_g - totales.carbos_g),
    grasa_g: targets.grasa_g == null ? null : r1(targets.grasa_g - totales.grasa_g),
  };

  return { dia, comidas: entradas, totales, tipo_dia, targets, restante };
}

export async function registrarComida(body: Record<string, any>) {
  const momento = body.momento?.trim() || 'snack';
  if (!MOMENTOS.includes(momento)) {
    throw error400(`momento debe ser uno de: ${MOMENTOS.join(', ')}`);
  }
  const hayMacro = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g'].some((k) => numOrNull(body[k]) != null);
  if (!body.alimento_id && !body.descripcion_libre?.trim() && !hayMacro) {
    throw error400('alimento_id, descripcion_libre o macros requeridos');
  }
  const tipo_dia = body.tipo_dia?.trim() || 'normal';
  if (!TIPOS_DIA.includes(tipo_dia)) throw error400('tipo_dia inválido');
  const source = body.source?.trim() || 'manual';
  if (!SOURCES.includes(source)) throw error400('source inválido');

  const macros = await resolverMacros(body);
  const microsInsert: Record<string, number | null> = {};
  for (const c of MICROS) microsInsert[c] = (macros as Record<string, number | null>)[c] ?? null;

  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('comidas_log')
    .insert([{
      fecha: body.fecha?.trim() || hoyGuayaquil(),
      momento,
      alimento_id: body.alimento_id || null,
      descripcion_libre: body.descripcion_libre?.trim() || null,
      cantidad_g: macros.cantidad_g,
      kcal: macros.kcal,
      proteina_g: macros.proteina_g,
      carbos_g: macros.carbos_g,
      grasa_g: macros.grasa_g,
      fibra_g: macros.fibra_g,
      ...microsInsert,
      foto_url: body.foto_url?.trim() || null,
      source,
      tipo_dia,
      notas: body.notas?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw error;
  // Fire-and-forget: actualiza contadores de uso del alimento (recientes/frecuentes
  // del picker). RPC atomica (alimento_incrementar_uso), no bloquea la respuesta.
  if (body.alimento_id) {
    sb.rpc('alimento_incrementar_uso', { p_id: body.alimento_id }).then(() => null).catch(() => null);
  }
  // Anti-farming (plan B): cap de 4 eventos comida_log/día antes de dejar de otorgar XP.
  sb.from('xp_events').select('id', { count: 'exact', head: true }).eq('tipo', 'comida_log').eq('fecha', hoyLocal())
    .then(({ count }) => {
      if ((count ?? 0) < 4) {
        registrarEvento(sb, { tipo: 'comida_log', ref_tabla: 'comidas_log', ref_id: data.id }).catch(() => null);
      }
    })
    .catch(() => null);
  return data;
}

export async function actualizarComida(id: string, body: Record<string, any>) {
  if ('momento' in body && !MOMENTOS.includes(body.momento?.trim())) {
    throw error400(`momento debe ser uno de: ${MOMENTOS.join(', ')}`);
  }
  if ('tipo_dia' in body && !TIPOS_DIA.includes(body.tipo_dia?.trim())) {
    throw error400('tipo_dia inválido');
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Si cambia alimento/cantidad, recalcular macros SOLO cuando hay alimento referenciado.
  // Se reobtiene el alimento_id y la cantidad actuales de la fila para no perderlos al editar
  // solo uno de los dos. Sin alimento (entrada libre) NO se tocan los macros salvo override.
  let recalculado = false;
  if ('alimento_id' in body || 'cantidad_g' in body) {
    const sbCur = getSupabaseServer();
    const { data: actual } = await sbCur
      .from('comidas_log').select('alimento_id, cantidad_g').eq('id', id).single();
    const alimentoId = 'alimento_id' in body ? (body.alimento_id || null) : (actual?.alimento_id ?? null);
    const cantidad = 'cantidad_g' in body ? numOrNull(body.cantidad_g) : numOrNull(actual?.cantidad_g);
    if ('alimento_id' in body) patch.alimento_id = alimentoId;
    if ('cantidad_g' in body) patch.cantidad_g = cantidad;
    if (alimentoId != null && cantidad != null) {
      Object.assign(patch, await resolverMacros({ alimento_id: alimentoId, cantidad_g: cantidad }));
      recalculado = true;
    }
  }
  for (const c of ['momento', 'descripcion_libre', 'foto_url', 'tipo_dia', 'notas', 'fecha']) {
    if (c in body) patch[c] = typeof body[c] === 'string' ? body[c].trim() || null : body[c];
  }
  // Override manual de macros cuando no hubo recálculo por alimento (entrada libre).
  if (!recalculado) {
    for (const c of ['kcal', 'proteina_g', 'carbos_g', 'grasa_g', 'fibra_g']) {
      if (c in body) patch[c] = numOrNull(body[c]);
    }
  }
  const sb = getSupabaseServer();
  const { data, error } = await sb.from('comidas_log').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarComida(id: string): Promise<void> {
  const sb = getSupabaseServer();
  const { error } = await sb.from('comidas_log').delete().eq('id', id);
  if (error) throw error;
}
