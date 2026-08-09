// Evaluación de logros (achievements) del módulo GFIT. Lógica pura, testeable con
// node:test. Traduce el estado real (sesiones, series, logros ya obtenidos) contra el
// catálogo `gfit_logros` (seed en supabase/migrations/20260719000200_gfit_logros.sql,
// research-gfit.md sección "Achievements") y devuelve los logros NUEVOS a otorgar.
//
// Nota de diseño: la investigación describe 12 achievements pero el enum de
// `umbral.tipo` tiene 11 valores (racha_dias, pr, tonelaje_total, adherencia_pct,
// doble_progresion, grupos_mev_semana, sorpresa_sesiones, primera_sesion,
// sesion_tras_lapso, supera_promedio, meses_activos). "Reinicio con Fuerza" (sesión en
// lunes/día 1 de mes, fresh start landmark) y "Antirrendición" (sesión tras romper
// racha) comparten el tipo `sesion_tras_lapso`, distinguidos por `umbral.modo`
// ('landmark' | 'tras_racha_rota'): ambos son variantes de "sesión disparada por un
// momento temporal específico". Ver seed para el detalle de cada slug.

import { addDias, diaIso } from '../habitos/fechas.ts';
import { rachaDiaria } from '../habitos/racha.ts';
import { tonelaje, type SerieVolumen } from './volumen.ts';
import { MEV_SETS } from './recovery.ts';

const TODOS_LOS_DIAS = [1, 2, 3, 4, 5, 6, 7];

export interface LogroPrevio {
  slug: string;
  nivel: number;
}

export interface SesionResumen {
  /** Fecha (YYYY-MM-DD) de la sesión. */
  fecha: string;
}

/** Serie con el grupo muscular ya resuelto (para grupos_mev_semana). */
export interface SerieConGrupo extends SerieVolumen {
  grupo?: string | null;
}

export interface CatalogoLogro {
  slug: string;
  activo: boolean;
  /** Config del umbral: siempre trae `tipo` + params propios de ese tipo. */
  umbral: Record<string, unknown> & { tipo: string };
}

export interface ContextoLogros {
  /** Catálogo completo (gfit_logros), incluye inactivos (se filtran aquí). */
  catalogo: CatalogoLogro[];
  /** Logros ya obtenidos (gfit_logros_obtenidos), para no repetir e incrementar nivel. */
  logrosPrevios: LogroPrevio[];
  /** Todas las sesiones registradas (para racha, primera_sesion, meses_activos, etc). */
  sesiones: SesionResumen[];
  /** Todas las series históricas relevantes (para tonelaje_total, grupos_mev_semana). */
  seriesHistoricas: SerieConGrupo[];
  /** Hoy (YYYY-MM-DD), ancla de todos los cálculos temporales. */
  hoy: string;
  /** true si el llamador ya determinó que la última serie registrada bate un 1RM histórico. */
  prNuevo?: boolean;
  /** true si el llamador ya determinó que se completó un ciclo reps→carga en un ejercicio. */
  dobleProgresionCompletada?: boolean;
}

export interface LogroNuevo {
  slug: string;
  nivel: number;
}

function yaObtenido(previos: LogroPrevio[], slug: string, nivel: number): boolean {
  return previos.some((p) => p.slug === slug && p.nivel === nivel);
}

function maxNivelObtenido(previos: LogroPrevio[], slug: string): number {
  return previos.filter((p) => p.slug === slug).reduce((max, p) => Math.max(max, p.nivel), 0);
}

function numArray(v: unknown): number[] {
  return Array.isArray(v) ? v.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
}

function fechasSesiones(sesiones: SesionResumen[]): Set<string> {
  return new Set(sesiones.map((s) => s.fecha));
}

// ─── racha_dias: N días consecutivos con sesión (tiers, ej. 7/30/90). ─────────────
function evaluarRachaDias(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  const dias = numArray(logro.umbral.dias);
  if (!dias.length) return [];
  const fechas = fechasSesiones(ctx.sesiones);
  const { actual } = rachaDiaria(fechas, TODOS_LOS_DIAS, ctx.hoy);
  const nuevos: LogroNuevo[] = [];
  dias.forEach((umbralDias, idx) => {
    const nivel = idx + 1;
    if (actual >= umbralDias && !yaObtenido(ctx.logrosPrevios, logro.slug, nivel)) {
      nuevos.push({ slug: logro.slug, nivel });
    }
  });
  return nuevos;
}

// ─── pr: nuevo 1RM estimado supera el histórico. Repetible, nivel incrementa. ─────
function evaluarPr(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  if (!ctx.prNuevo) return [];
  const nivel = maxNivelObtenido(ctx.logrosPrevios, logro.slug) + 1;
  return [{ slug: logro.slug, nivel }];
}

// ─── primera_sesion: primera sesión registrada. Una sola vez. ─────────────────────
function evaluarPrimeraSesion(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  if (ctx.sesiones.length === 0) return [];
  if (yaObtenido(ctx.logrosPrevios, logro.slug, 1)) return [];
  return [{ slug: logro.slug, nivel: 1 }];
}

// ─── sesion_tras_lapso: landmark temporal (lunes/día 1) o sesión tras romper racha. ──
function evaluarSesionTrasLapso(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  const modo = String(logro.umbral.modo ?? 'landmark');
  const fechas = ctx.sesiones.map((s) => s.fecha).sort();
  if (!fechas.includes(ctx.hoy)) return []; // solo dispara si hoy hubo sesión

  if (modo === 'landmark') {
    const esLunes = diaIso(ctx.hoy) === 1;
    const esDiaUnoDeMes = Number(ctx.hoy.slice(8, 10)) === 1;
    if (!esLunes && !esDiaUnoDeMes) return [];
    const nivel = maxNivelObtenido(ctx.logrosPrevios, logro.slug) + 1;
    return [{ slug: logro.slug, nivel }];
  }

  // modo === 'tras_racha_rota': hoy hay sesión y la sesión previa quedó a >= diasGap
  // días de distancia (hubo un hueco real, no solo "ayer sin entrenar").
  const diasGap = Number(logro.umbral.diasGap) || 3;
  const anteriores = fechas.filter((f) => f < ctx.hoy);
  if (!anteriores.length) return [];
  const ultimaAnterior = anteriores[anteriores.length - 1];
  const gapDias = Math.round(
    (new Date(`${ctx.hoy}T12:00:00`).getTime() - new Date(`${ultimaAnterior}T12:00:00`).getTime()) / 86_400_000,
  );
  if (gapDias < diasGap) return [];
  const nivel = maxNivelObtenido(ctx.logrosPrevios, logro.slug) + 1;
  return [{ slug: logro.slug, nivel }];
}

// ─── tonelaje_total: tonelaje acumulado histórico cruza tiers (1k/10k/100k). ──────
function evaluarTonelajeTotal(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  const tiers = numArray(logro.umbral.tiers);
  if (!tiers.length) return [];
  const total = tonelaje(ctx.seriesHistoricas);
  const nuevos: LogroNuevo[] = [];
  tiers.forEach((tier, idx) => {
    const nivel = idx + 1;
    if (total >= tier && !yaObtenido(ctx.logrosPrevios, logro.slug, nivel)) {
      nuevos.push({ slug: logro.slug, nivel });
    }
  });
  return nuevos;
}

// ─── adherencia_pct: % de días entrenados en las últimas N semanas >= umbral. ─────
function evaluarAdherenciaPct(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  const pctObjetivo = Number(logro.umbral.pct) || 80;
  const semanas = Number(logro.umbral.semanas) || 4;
  if (yaObtenido(ctx.logrosPrevios, logro.slug, 1)) return [];
  const dias = semanas * 7;
  const desde = addDias(ctx.hoy, -(dias - 1));
  const fechasUnicas = new Set(ctx.sesiones.map((s) => s.fecha).filter((f) => f >= desde && f <= ctx.hoy));
  const pctReal = (fechasUnicas.size / dias) * 100;
  if (pctReal >= pctObjetivo) return [{ slug: logro.slug, nivel: 1 }];
  return [];
}

// ─── doble_progresion: ciclo reps→carga completado en un ejercicio. Repetible. ────
function evaluarDobleProgresion(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  if (!ctx.dobleProgresionCompletada) return [];
  const nivel = maxNivelObtenido(ctx.logrosPrevios, logro.slug) + 1;
  return [{ slug: logro.slug, nivel }];
}

// ─── grupos_mev_semana: >= MEV en N grupos distintos en la semana que termina hoy. ──
function evaluarGruposMevSemana(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  const grupoObjetivo = Number(logro.umbral.grupos) || 5;
  const desde = addDias(ctx.hoy, -6);
  const conteo: Record<string, number> = {};
  for (const s of ctx.seriesHistoricas) {
    if (s.fecha < desde || s.fecha > ctx.hoy) continue;
    if (!s.grupo || s.tipo === 'warmup') continue;
    conteo[s.grupo] = (conteo[s.grupo] ?? 0) + 1;
  }
  const gruposEnMev = Object.entries(conteo).filter(([grupo, sets]) => sets >= (MEV_SETS[grupo] ?? 10)).length;
  if (gruposEnMev < grupoObjetivo) return [];
  const nivel = maxNivelObtenido(ctx.logrosPrevios, logro.slug) + 1;
  return [{ slug: logro.slug, nivel }];
}

// ─── sorpresa_sesiones: umbral oculto (no mostrado en UI), sesiones totales >= N. ──
function evaluarSorpresaSesiones(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  if (yaObtenido(ctx.logrosPrevios, logro.slug, 1)) return [];
  const umbralActual = Number(logro.umbral.umbral_actual);
  if (!Number.isFinite(umbralActual)) return [];
  if (ctx.sesiones.length < umbralActual) return [];
  return [{ slug: logro.slug, nivel: 1 }];
}

// ─── supera_promedio: tonelaje de la sesión de hoy > promedio de las N semanas previas. ──
function evaluarSuperaPromedio(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  if (!ctx.sesiones.some((s) => s.fecha === ctx.hoy)) return [];
  const semanas = Number(logro.umbral.semanas) || 4;
  const desde = addDias(ctx.hoy, -(semanas * 7));
  const hasta = addDias(ctx.hoy, -1);

  const porDia = new Map<string, number>();
  for (const s of ctx.seriesHistoricas) {
    if (s.fecha < desde || s.fecha > ctx.hoy) continue;
    if (s.tipo === 'warmup') continue;
    const peso = Number(s.pesoKg) || 0;
    const reps = Number(s.reps) || 0;
    porDia.set(s.fecha, (porDia.get(s.fecha) ?? 0) + peso * reps);
  }

  const tonelajeHoy = porDia.get(ctx.hoy) ?? 0;
  const previos = Array.from(porDia.entries())
    .filter(([fecha]) => fecha >= desde && fecha <= hasta)
    .map(([, total]) => total);
  if (previos.length < 3 || tonelajeHoy <= 0) return []; // historial insuficiente para comparar
  const promedio = previos.reduce((a, b) => a + b, 0) / previos.length;
  if (tonelajeHoy <= promedio) return [];
  const nivel = maxNivelObtenido(ctx.logrosPrevios, logro.slug) + 1;
  return [{ slug: logro.slug, nivel }];
}

// ─── meses_activos: N meses calendario distintos con al menos una sesión. ─────────
function evaluarMesesActivos(logro: CatalogoLogro, ctx: ContextoLogros): LogroNuevo[] {
  const mesesObjetivo = Number(logro.umbral.meses) || 12;
  if (yaObtenido(ctx.logrosPrevios, logro.slug, 1)) return [];
  const meses = new Set(ctx.sesiones.map((s) => s.fecha.slice(0, 7)));
  if (meses.size < mesesObjetivo) return [];
  return [{ slug: logro.slug, nivel: 1 }];
}

const EVALUADORES: Record<string, (logro: CatalogoLogro, ctx: ContextoLogros) => LogroNuevo[]> = {
  racha_dias: evaluarRachaDias,
  pr: evaluarPr,
  primera_sesion: evaluarPrimeraSesion,
  sesion_tras_lapso: evaluarSesionTrasLapso,
  tonelaje_total: evaluarTonelajeTotal,
  adherencia_pct: evaluarAdherenciaPct,
  doble_progresion: evaluarDobleProgresion,
  grupos_mev_semana: evaluarGruposMevSemana,
  sorpresa_sesiones: evaluarSorpresaSesiones,
  supera_promedio: evaluarSuperaPromedio,
  meses_activos: evaluarMesesActivos,
};

/**
 * Evalúa todo el catálogo de logros activos contra el contexto real y devuelve los
 * logros NUEVOS (no obtenidos aún) a otorgar. Determinístico: dos llamadas con el
 * mismo contexto devuelven el mismo resultado (sin RNG en tiempo de evaluación; el
 * "azar" de sorpresa_sesiones ya quedó fijado en `umbral.umbral_actual` al sembrar).
 */
export function evaluarLogros(ctx: ContextoLogros): LogroNuevo[] {
  const nuevos: LogroNuevo[] = [];
  for (const logro of ctx.catalogo) {
    if (!logro.activo) continue;
    const evaluador = EVALUADORES[logro.umbral?.tipo];
    if (!evaluador) continue;
    nuevos.push(...evaluador(logro, ctx));
  }
  return nuevos;
}
