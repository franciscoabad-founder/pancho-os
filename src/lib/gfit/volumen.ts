// Cálculo de volumen/tonelaje/tiempo/calendario del módulo GFIT. Lógica pura,
// testeable con node:test. Consume series ya resueltas a peso_kg canónico (ver
// lib/gfit/unidades.ts) y fechas YYYY-MM-DD locales (America/Guayaquil, ver
// lib/habitos/fechas.ts).

import { addDias } from '../habitos/fechas.ts';

/** Tipos de serie que cuentan como esfuerzo real (se excluye warmup de todo cálculo). */
const TIPOS_EFECTIVOS = new Set(['working', 'drop', 'failure']);

export interface SerieVolumen {
  /** Fecha (YYYY-MM-DD) de la sesión a la que pertenece la serie. */
  fecha: string;
  pesoKg: number | null | undefined;
  reps: number | null | undefined;
  /** warmup | working | drop | failure. */
  tipo: string;
  ejercicioId?: string | null;
}

export type RangoVolumen = '7d' | '14d' | '1m' | '12m' | 'all';

const DIAS_POR_RANGO: Record<Exclude<RangoVolumen, 'all'>, number> = {
  '7d': 7,
  '14d': 14,
  '1m': 30,
  '12m': 365,
};

/** Fecha de inicio (YYYY-MM-DD, inclusive) de un rango terminando en `hoy`. `all` => null (sin filtro). */
function inicioRango(rango: RangoVolumen, hoy: string): string | null {
  if (rango === 'all') return null;
  const dias = DIAS_POR_RANGO[rango];
  return addDias(hoy, -(dias - 1));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function esEfectiva(tipo: string): boolean {
  return TIPOS_EFECTIVOS.has(tipo);
}

/** Tonelaje total (kg) de un conjunto de series: Σ peso_kg * reps, solo series de
 * trabajo/drop/failure (warmup excluida, no representa esfuerzo real acumulado). */
export function tonelaje(series: SerieVolumen[]): number {
  let total = 0;
  for (const s of series ?? []) {
    if (!esEfectiva(s.tipo)) continue;
    const peso = Number(s.pesoKg) || 0;
    const reps = Number(s.reps) || 0;
    total += peso * reps;
  }
  return round2(total);
}

export interface DiaTotal {
  fecha: string;
  total: number;
}

export interface VolumenRango {
  total: number;
  porDia: DiaTotal[];
}

/** Enumera todas las fechas (YYYY-MM-DD) entre `desde` y `hasta`, ambas inclusive. */
function rangoDeFechas(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  let cursor = desde;
  let guard = 0;
  while (cursor <= hasta && guard < 3660) {
    fechas.push(cursor);
    cursor = addDias(cursor, 1);
    guard += 1;
  }
  return fechas;
}

/** Tonelaje total y por día dentro de un rango terminando en `hoy` (incluye días sin
 * entreno con total 0, útil para graficar). */
export function volumenPorRango(series: SerieVolumen[], rango: RangoVolumen, hoy: string): VolumenRango {
  const desde = inicioRango(rango, hoy);
  const filtradas = (series ?? []).filter((s) => esEfectiva(s.tipo) && (desde === null || s.fecha >= desde) && s.fecha <= hoy);

  const porFecha = new Map<string, number>();
  for (const s of filtradas) {
    const peso = Number(s.pesoKg) || 0;
    const reps = Number(s.reps) || 0;
    porFecha.set(s.fecha, (porFecha.get(s.fecha) ?? 0) + peso * reps);
  }

  const fechasEje = desde ? rangoDeFechas(desde, hoy) : Array.from(porFecha.keys()).sort();
  const porDia = fechasEje.map((fecha) => ({ fecha, total: round2(porFecha.get(fecha) ?? 0) }));
  const total = round2(porDia.reduce((a, d) => a + d.total, 0));

  return { total, porDia };
}

export interface SesionTiempo {
  fecha: string;
  duracionMin: number | null | undefined;
}

/** Minutos totales y por día dentro de un rango terminando en `hoy` (misma forma que
 * volumenPorRango, para reusar el mismo componente de gráfico en la UI). */
export function tiempoPorRango(sesiones: SesionTiempo[], rango: RangoVolumen, hoy: string): VolumenRango {
  const desde = inicioRango(rango, hoy);
  const filtradas = (sesiones ?? []).filter((s) => (desde === null || s.fecha >= desde) && s.fecha <= hoy);

  const porFecha = new Map<string, number>();
  for (const s of filtradas) {
    const min = Number(s.duracionMin) || 0;
    porFecha.set(s.fecha, (porFecha.get(s.fecha) ?? 0) + min);
  }

  const fechasEje = desde ? rangoDeFechas(desde, hoy) : Array.from(porFecha.keys()).sort();
  const porDia = fechasEje.map((fecha) => ({ fecha, total: round2(porFecha.get(fecha) ?? 0) }));
  const total = round2(porDia.reduce((a, d) => a + d.total, 0));

  return { total, porDia };
}

export interface EjercicioMuscular {
  id: string;
  /** Grupos musculares primarios (slugs de gfit_taxonomia tipo='grupo_muscular'),
   * derivados de ejercicios_catalogo.musculos_primarios [{grupo,sub}]. */
  gruposPrimarios: string[];
}

/**
 * Sets efectivos (no warmup) por grupo muscular en los últimos `meses` meses. Un set
 * de un ejercicio compuesto cuenta una vez por CADA grupo primario que trabaja
 * (convención estándar de tracking de volumen: un set de press banca cuenta para
 * pecho Y tríceps Y hombros si esos son primarios del ejercicio).
 */
export function muscleBreakdown(
  series: SerieVolumen[],
  ejercicios: EjercicioMuscular[],
  meses = 3,
  hoy?: string,
): Record<string, number> {
  const hoyRef = hoy ?? new Date().toISOString().slice(0, 10);
  const desde = addDias(hoyRef, -(meses * 30));
  const gruposPorEjercicio = new Map<string, string[]>();
  for (const e of ejercicios ?? []) gruposPorEjercicio.set(e.id, e.gruposPrimarios ?? []);

  const conteo: Record<string, number> = {};
  for (const s of series ?? []) {
    if (!esEfectiva(s.tipo)) continue;
    if (s.fecha < desde || s.fecha > hoyRef) continue;
    const grupos = (s.ejercicioId ? gruposPorEjercicio.get(s.ejercicioId) : undefined) ?? [];
    for (const g of grupos) conteo[g] = (conteo[g] ?? 0) + 1;
  }
  return conteo;
}

/** Fechas únicas (YYYY-MM-DD) en las que hubo al menos una sesión, ordenadas asc. */
export function calendarioEntrenos(sesiones: Array<{ fecha: string }>): string[] {
  const set = new Set((sesiones ?? []).map((s) => s.fecha));
  return Array.from(set).sort();
}
