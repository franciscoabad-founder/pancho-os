// Modelo de recuperación muscular del módulo GFIT. Lógica pura, testeable con
// node:test. Implementa el modelo dictado en la investigación (research-gfit.md,
// sección "Modelo Muscle Recovery"):
//
//   recovery_hours = base_hours[grupo] * (1 + 0.3 * max(0, working_sets - mev)/mev) * mult_intensidad
//   mult_intensidad: <65% 1RM -> 0.85 | 65-80% -> 1.0 | >80% -> 1.25
//   recovery_pct(t) = 1 - e^(-t/tau), tau = recovery_hours/3  (=> ~95% recuperado en t = recovery_hours)
//   Stacking: fatiga_stock_nueva = stock_anterior * (1 - recovery_pct(t)) + fatiga_nueva (no resetea el reloj)
//
// Grupos musculares: usan los slugs de `grupo_muscular` en gfit_taxonomia (abs, back,
// biceps, chest, forearms, glutes, shoulders, triceps, upper-leg, lower-leg, cardio).
// 'cardio' no es un grupo con recuperación muscular -> queda fuera de BASE_HOURS/MEV_SETS
// y de estadoRecuperacion (se filtra).

/** Intensidad por defecto (% de 1RM) cuando no se puede calcular desde el histórico. */
export const DEFAULT_INTENSIDAD_PCT = 70;

/** Umbral de fatiga remanente por debajo del cual se considera "recuperado" (~95%, mismo
 * punto donde recoveryPct satura con tau = T/3: e^-3 ≈ 4.98% de fatiga remanente). */
const UMBRAL_FATIGA_RECUPERADO = 0.05;

/**
 * base_hours por grupo muscular (investigación: grandes 48-72h, pequeños 24-48h;
 * se usa el punto medio de cada rango: grandes 60h, pequeños 36h).
 * `glutes` y `forearms` no tienen cita explícita en la investigación: se extrapolan
 * por analogía (glutes = grupo grande, compuesto en squat/hinge; forearms = grupo
 * pequeño/aislado, análogo a brazos).
 */
export const BASE_HOURS: Record<string, number> = {
  chest: 60, // grande (pecho)
  back: 60, // grande (espalda)
  'upper-leg': 60, // grande (cuádriceps + isquiotibiales)
  glutes: 60, // grande (extrapolado: compuesto en squat/hinge)
  shoulders: 36, // pequeño
  biceps: 36, // pequeño (brazos)
  triceps: 36, // pequeño (brazos)
  'lower-leg': 36, // pequeño (pantorrillas)
  abs: 36, // pequeño
  forearms: 36, // pequeño (extrapolado, análogo a brazos)
};

/** base_hours de reserva para un grupo no listado (promedio grande/pequeño). */
const BASE_HOURS_DEFAULT = 48;

/**
 * MEV sets/semana por grupo (Israetel/RP, investigación). Valores de punto medio de
 * cada rango: pecho 11 (10-12), espalda 13 (12-14), hombros 11 (10-12), piernas
 * (upper-leg combina cuádriceps 10-12 e isquios 8-10) 10, pantorrillas 11 (10-12),
 * brazos 9 (8-10, aplicado a biceps y triceps por separado), abs 10.
 * `glutes` y `forearms` sin cita explícita: valores conservadores extrapolados.
 */
export const MEV_SETS: Record<string, number> = {
  chest: 11,
  back: 13,
  shoulders: 11,
  'upper-leg': 10,
  'lower-leg': 11,
  abs: 10,
  biceps: 9,
  triceps: 9,
  glutes: 10, // extrapolado
  forearms: 6, // extrapolado (grupo pequeño/aislado, menor prioridad de volumen directo)
};

const MEV_SETS_DEFAULT = 10;

/** Redondea a 2 decimales, evitando artefactos de punto flotante. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Multiplicador de intensidad sobre recovery_hours: series pesadas (>80% 1RM) tardan
 * más en recuperarse; series livianas (<65%) se recuperan más rápido.
 */
export function multiplicadorIntensidad(intensidadPct: number): number {
  const pct = Number(intensidadPct);
  if (!Number.isFinite(pct) || pct < 65) return 0.85;
  if (pct <= 80) return 1.0;
  return 1.25;
}

/**
 * Horas de recuperación totales (T) para un grupo dado el volumen (working sets) y la
 * intensidad relativa (%1RM) de la sesión. `workingSets` cuenta solo series de trabajo
 * (no warmup).
 */
export function recoveryHours(
  grupo: string,
  workingSets: number,
  intensidadPct: number = DEFAULT_INTENSIDAD_PCT,
): number {
  const base = BASE_HOURS[grupo] ?? BASE_HOURS_DEFAULT;
  const mev = MEV_SETS[grupo] ?? MEV_SETS_DEFAULT;
  const sets = Math.max(0, Number(workingSets) || 0);
  const volFactor = 1 + (0.3 * Math.max(0, sets - mev)) / mev;
  const mult = multiplicadorIntensidad(intensidadPct);
  return round2(base * volFactor * mult);
}

/**
 * % recuperado (0-100) transcurridas `horasTranscurridas` horas, dado un T total de
 * `recoveryHoursTotal` horas: 1 - e^(-3t/T) (tau = T/3 => ~95% en t = T).
 */
export function recoveryPct(horasTranscurridas: number, recoveryHoursTotal: number): number {
  const T = Number(recoveryHoursTotal) || 0;
  if (T <= 0) return 100;
  const t = Math.max(0, Number(horasTranscurridas) || 0);
  const tau = T / 3;
  const pct = (1 - Math.exp(-t / tau)) * 100;
  return round2(Math.min(100, Math.max(0, pct)));
}

/**
 * Promedio de intensidad (%1RM) a partir de una lista de porcentajes ya calculados por
 * serie (peso_kg/est1RM_histórico * 100). Si no hay datos suficientes (histórico sin
 * 1RM previo), cae al default documentado en la investigación.
 */
export function intensidadPromedio(pcts: Array<number | null | undefined>): number {
  const validos = (pcts ?? []).filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0);
  if (!validos.length) return DEFAULT_INTENSIDAD_PCT;
  const avg = validos.reduce((a, b) => a + b, 0) / validos.length;
  return round2(avg);
}

/** % de intensidad de una serie puntual (peso_kg / est1RM histórico * 100). Fallback al
 * default si no hay 1RM histórico calculable para ese ejercicio. */
export function intensidadDeSerie(pesoKg: number | null | undefined, est1RMHistorico: number | null | undefined): number {
  const peso = Number(pesoKg);
  const rm = Number(est1RMHistorico);
  if (!Number.isFinite(peso) || peso <= 0 || !Number.isFinite(rm) || rm <= 0) return DEFAULT_INTENSIDAD_PCT;
  return round2((peso / rm) * 100);
}

export interface EventoGrupo {
  /** Slug del grupo muscular (gfit_taxonomia tipo='grupo_muscular'). */
  grupo: string;
  /** Fecha/hora de la sesión (para calcular horas transcurridas entre eventos). */
  fecha: string | Date;
  /** Series de trabajo (no warmup) de ese grupo en esa sesión. */
  workingSets: number;
  /** %1RM promedio de esa sesión para ese grupo; si se omite usa el default. */
  intensidadPct?: number;
}

export interface EstadoGrupo {
  /** % recuperado (0-100). 100 = totalmente fresco, 0 = recién entrenado / muy fatigado. */
  rate_pct: number;
  /** Horas restantes estimadas hasta considerarse recuperado (~95%, remanente <=5%). */
  horas_restantes: number;
}

function aHoras(desde: Date, hasta: Date): number {
  return Math.max(0, (hasta.getTime() - desde.getTime()) / 3_600_000);
}

function aFecha(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

/**
 * Estado de recuperación por grupo muscular a partir del historial reciente de
 * sesiones (eventos por grupo). Aplica el modelo de stacking: cada evento nuevo se
 * suma (como fatiga_nueva = 1 unidad) sobre lo que quedaba del stock anterior (decaído
 * según el tiempo transcurrido y el T de la sesión que lo generó); "no resetea el
 * reloj". `rate_pct` y `horas_restantes` se calculan al momento `hoy`.
 */
export function estadoRecuperacion(
  eventos: EventoGrupo[],
  hoy: string | Date = new Date(),
): Record<string, EstadoGrupo> {
  const ahora = aFecha(hoy);
  const porGrupo = new Map<string, EventoGrupo[]>();
  for (const ev of eventos ?? []) {
    if (!ev?.grupo) continue;
    if (!porGrupo.has(ev.grupo)) porGrupo.set(ev.grupo, []);
    porGrupo.get(ev.grupo)!.push(ev);
  }

  const resultado: Record<string, EstadoGrupo> = {};

  for (const [grupo, lista] of porGrupo.entries()) {
    const ordenados = [...lista].sort((a, b) => aFecha(a.fecha).getTime() - aFecha(b.fecha).getTime());

    let stock = 0;
    let tRef: Date | null = null;
    let tPrev = recoveryHours(grupo, 0, DEFAULT_INTENSIDAD_PCT);

    for (const ev of ordenados) {
      const fechaEv = aFecha(ev.fecha);
      const tEv = recoveryHours(grupo, ev.workingSets, ev.intensidadPct ?? DEFAULT_INTENSIDAD_PCT);
      if (tRef) {
        const horas = aHoras(tRef, fechaEv);
        const decaido = recoveryPct(horas, tPrev) / 100;
        stock = stock * (1 - decaido);
      }
      stock += 1;
      tRef = fechaEv;
      tPrev = tEv;
    }

    let stockActual = stock;
    if (tRef) {
      const horasHoy = aHoras(tRef, ahora);
      const decaidoHoy = recoveryPct(horasHoy, tPrev) / 100;
      stockActual = stock * (1 - decaidoHoy);
    }

    const ratePct = round2(Math.min(100, Math.max(0, (1 - stockActual) * 100)));
    let horasRestantes = 0;
    if (stockActual > UMBRAL_FATIGA_RECUPERADO && tPrev > 0) {
      horasRestantes = Math.max(0, round2((tPrev / 3) * Math.log(stockActual / UMBRAL_FATIGA_RECUPERADO)));
    }

    resultado[grupo] = { rate_pct: ratePct, horas_restantes: horasRestantes };
  }

  return resultado;
}
