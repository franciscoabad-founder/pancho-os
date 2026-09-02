// Logica de /api/biometricas, portada de src/pages/api/biometricas.ts.
//
// Contrato completo del flujo n8n (Google Health API) en
// apps/web/docs/contrato-biometricas.md.
//
// OVERLAP DE PESO CORPORAL: peso_kg vive tambien en cuerpo_log
// (/api/salud/cuerpo, log de composicion corporal del modulo Salud). Regla de
// lectura acordada: cuerpo_log manda, esta tabla rellena los dias sin medicion
// propia. Implementada y testeada en src/lib/salud/peso.ts.
// Esta ruta NO cambia por eso: sigue siendo el ingreso crudo de fuentes
// externas y su modelo de escritura queda igual. La reconciliacion es solo de
// lectura y se cablea del lado de /api/salud/cuerpo.

import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';
import { hoyGuayaquil, numOrNull } from '../lib/salud/apiHelpers.ts';

const DIAS_DEFAULT = 30;

interface DiaBiometrico {
  fecha?: string;
  pasos?: unknown;
  sueno_min?: unknown;
  peso_kg?: unknown;
  fc_reposo?: unknown;
  fuente?: unknown;
  raw?: unknown;
  [campo: string]: unknown;
}

// Metricas de Health Connect que llegan como numero decimal no negativo (o ausentes).
// Ver Android/.../data/health/HealthConnectSync.kt (payload()) para el origen de cada campo.
const CAMPOS_HEALTH_CONNECT = [
  'fc_promedio',
  'vfc_ms',
  'calorias_activas_kcal',
  'calorias_totales_kcal',
  'distancia_m',
  'ejercicio_min',
  'cadencia_pasos_promedio',
  'velocidad_promedio_ms',
  'potencia_promedio_w',
  'pisos_subidos',
  'elevacion_ganada_m',
  'saturacion_o2_pct',
  'frecuencia_respiratoria',
  'presion_sistolica_mmhg',
  'presion_diastolica_mmhg',
  'glucosa_mg_dl',
  'temperatura_c',
  'temperatura_basal_c',
  'grasa_corporal_pct',
  'masa_osea_kg',
  'masa_magra_kg',
  'altura_cm',
  'tmb_kcal_dia',
  'vo2_max',
  'hidratacion_ml',
  'energia_consumida_kcal',
] as const;

// Entero no negativo o null. Usado para pasos, sueno_min y fc_reposo, que no aceptan
// decimales ni valores negativos (a diferencia de numOrNull genérico).
function intNoNegativoOrNull(v: unknown): number | null | 'invalido' {
  if (v === undefined || v === null || v === '') return null;
  const n = numOrNull(v);
  if (n === null) return 'invalido';
  if (!Number.isInteger(n) || n < 0) return 'invalido';
  return n;
}

// Decimal no negativo o null. Usado para las metricas de Health Connect que sí
// aceptan fracciones (distancia, calorías, VO2 max, temperatura, etc.).
function numNoNegativoOrNull(v: unknown): number | null | 'invalido' {
  if (v === undefined || v === null || v === '') return null;
  const n = numOrNull(v);
  if (n === null || n < 0) return 'invalido';
  return n;
}

// Valida y arma el payload de upsert para un día. Devuelve { error } si algo no cumple el
// contrato, o { payload } listo para insertar/actualizar.
function construirPayload(dia: DiaBiometrico): { error: string } | { payload: Record<string, unknown> } {
  const fecha = typeof dia.fecha === 'string' && dia.fecha.trim() ? dia.fecha.trim() : hoyGuayaquil();

  const pasos = intNoNegativoOrNull(dia.pasos);
  if (pasos === 'invalido') return { error: 'pasos debe ser un entero no negativo' };

  const sueno_min = intNoNegativoOrNull(dia.sueno_min);
  if (sueno_min === 'invalido') return { error: 'sueno_min debe ser un entero no negativo' };

  const fc_reposo = intNoNegativoOrNull(dia.fc_reposo);
  if (fc_reposo === 'invalido') return { error: 'fc_reposo debe ser un entero no negativo' };

  let peso_kg: number | null = null;
  if (dia.peso_kg !== undefined && dia.peso_kg !== null && dia.peso_kg !== '') {
    const n = numOrNull(dia.peso_kg);
    if (n === null || n <= 0) return { error: 'peso_kg debe ser numérico y mayor a 0' };
    peso_kg = n;
  }

  const metricasHealthConnect: Record<string, number> = {};
  for (const campo of CAMPOS_HEALTH_CONNECT) {
    const valor = numNoNegativoOrNull(dia[campo]);
    if (valor === 'invalido') return { error: `${campo} debe ser numérico y no negativo` };
    if (valor !== null) metricasHealthConnect[campo] = valor;
  }

  if (
    pasos === null && sueno_min === null && peso_kg === null && fc_reposo === null &&
    Object.keys(metricasHealthConnect).length === 0
  ) {
    return { error: 'se requiere al menos una metrica' };
  }

  const fuente = typeof dia.fuente === 'string' && dia.fuente.trim() ? dia.fuente.trim() : 'google_health';

  // El upsert MERGEA: solo se escriben las metricas que vinieron de verdad. Incluir
  // las ausentes como null las borraria del dia, y las sincronizaciones de Google
  // Health son parciales por naturaleza (los pasos llegan en la manana, el sueno
  // despues). Un POST de solo pasos no puede tumbar el peso ya registrado.
  const payload: Record<string, unknown> = {
    fecha,
    fuente,
    updated_at: new Date().toISOString(),
    ...metricasHealthConnect,
  };
  if (pasos !== null) payload.pasos = pasos;
  if (sueno_min !== null) payload.sueno_min = sueno_min;
  if (peso_kg !== null) payload.peso_kg = peso_kg;
  if (fc_reposo !== null) payload.fc_reposo = fc_reposo;
  if (dia.raw !== undefined && dia.raw !== null) payload.raw = dia.raw;

  return { payload };
}

/** Lista por rango (default ultimos 30 dias hasta hoy) o un dia puntual. */
export async function leerBiometricas(params: {
  fecha: string | null;
  desde: string | null;
  hasta: string | null;
}): Promise<Record<string, unknown>> {
  const sb = getSupabaseServer();

  if (params.fecha) {
    const { data, error } = await sb
      .from('biometricas_dia')
      .select('*')
      .eq('fecha', params.fecha)
      .maybeSingle();
    if (error) throw error;
    return { biometrica: data ?? null };
  }

  const hasta = params.hasta || hoyGuayaquil();
  let desde = params.desde;
  if (!desde) {
    const d = new Date(`${hasta}T00:00:00`);
    d.setDate(d.getDate() - (DIAS_DEFAULT - 1));
    desde = d.toISOString().slice(0, 10);
  }

  const { data, error } = await sb
    .from('biometricas_dia')
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return { biometricas: data ?? [] };
}

/**
 * Upsert idempotente por fecha. Acepta un dia unico o un batch { dias: [...] }
 * para que n8n pueda hacer backfill de varios dias en una sola llamada.
 */
export async function guardarBiometricas(body: any): Promise<Record<string, unknown>> {
  const sb = getSupabaseServer();

  if (Array.isArray(body?.dias)) {
    if (!body.dias.length) throw error400('dias no puede estar vacío');
    const payloads: Record<string, unknown>[] = [];
    for (const dia of body.dias) {
      const resultado = construirPayload(dia ?? {});
      if ('error' in resultado) throw error400(resultado.error);
      payloads.push(resultado.payload);
    }
    // Agrupamos los payloads por su firma de claves. PostgREST exige claves
    // homogeneas para upserts masivos. Al agrupar, evitamos rellenar con nulls
    // que causarian borrados no deseados, y reducimos N queries a solo K (una por grupo).
    const payloadsPorClaves = new Map<string, Record<string, unknown>[]>();
    for (const payload of payloads) {
      const firma = Object.keys(payload).sort().join(',');
      if (!payloadsPorClaves.has(firma)) payloadsPorClaves.set(firma, []);
      payloadsPorClaves.get(firma)!.push(payload);
    }

    const promesas = Array.from(payloadsPorClaves.values()).map(async (grupo) => {
      const { data, error } = await sb
        .from('biometricas_dia')
        .upsert(grupo, { onConflict: 'fecha' })
        .select();
      if (error) throw error;
      return data;
    });

    const resultados = await Promise.all(promesas);
    const filas = resultados.flat();
    return { biometricas: filas, n: filas.length };
  }

  const resultado = construirPayload(body ?? {});
  if ('error' in resultado) throw error400(resultado.error);

  const { data, error } = await sb
    .from('biometricas_dia')
    .upsert(resultado.payload, { onConflict: 'fecha' })
    .select()
    .single();
  if (error) throw error;
  return { biometrica: data };
}
