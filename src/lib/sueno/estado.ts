/**
 * Ensamblado del estado de sueno del dia: junta deuda, curva, ventanas, cafeina
 * y plan en un solo objeto.
 *
 * Vive aqui y no en el endpoint para que se pueda probar sin Supabase: el
 * endpoint /api/salud/sueno/hoy solo consulta las tablas y llama a esto.
 *
 * Modulo puro: recibe filas y un instante, devuelve el payload.
 */

import {
  curvaDelDia,
  horaLocal,
  msDeHoraLocal,
  sEquilibrioAlDespertar,
  simularS,
  tminDesdeDespertar,
  type Episodio,
} from './modelo.ts';
import { calcularDeuda, necesidadEstimada, restarDias, type NocheSueno, type ResultadoDeuda } from './deuda.ts';
import { ventanaSiesta, ventanasDelDia, type Ventana, type VentanaSiesta } from './ventanas.ts';
import { horaCorte, mgActivos, totalDelDia, type Dosis } from './cafeina.ts';
import { planDeuda, resumenPlan, type PlanSueno } from './plan.ts';

const H = 3_600_000;
export const DIAS_SIMULACION = 14;
/** Dosis de referencia para calcular la hora de corte (cafe filtrado, 240 ml). */
export const DOSIS_REFERENCIA_MG = 95;

export interface ConfigSueno {
  necesidad_h: number | string;
  necesidad_auto: boolean;
  hora_dormir: string;
  hora_despertar: string;
  deuda_objetivo_h: number | string;
  siestas_ok: boolean;
  cafeina_vida_media_h: number | string;
  cafeina_umbral_mg: number | string;
  [k: string]: unknown;
}

export interface FilaSesion {
  id: string;
  fecha: string;
  inicio: string;
  fin: string;
  minutos: number;
  siesta: boolean;
  calidad: number | null;
  fuente: string;
  notas: string | null;
}

export interface FilaBiometrica {
  fecha: string;
  sueno_min: number | null;
}

export interface FilaDosis {
  id: string;
  fecha: string;
  tomado_at: string;
  mg: number;
  bebida: string | null;
}

export interface EntradaEstado {
  /** Dia a evaluar, YYYY-MM-DD en hora local. */
  hoy: string;
  ahoraMs: number;
  config: ConfigSueno;
  sesiones: FilaSesion[];
  biometricas: FilaBiometrica[];
  dosis: FilaDosis[];
}

export interface EstadoSueno {
  hoy: string;
  generado_at: string;
  config: ConfigSueno;
  necesidad: { horas: number; origen: 'auto' | 'config' };
  deuda: ResultadoDeuda;
  anclas: {
    despertar_ms: number;
    dormir_ms: number;
    hora_despertar: number;
    hora_dormir: number;
    tmin: number;
    despertar_real: boolean;
    s_inicial: number;
  };
  curva: { hora: number; ms: number; alerta: number }[];
  ahora: { hora: number; alerta: number; ventana: string | null } | null;
  ventanas: Ventana[];
  siesta: VentanaSiesta | null;
  cafeina: {
    vida_media_h: number;
    umbral_mg: number;
    mg_ahora: number;
    mg_al_dormir: number;
    total_hoy_mg: number;
    hora_corte: number | null;
    dosis: FilaDosis[];
  };
  sesiones: FilaSesion[];
  plan: PlanSueno;
  resumen: string;
}

/** "23:00:00" -> 23. */
export function horaDecimal(t: string | null | undefined, fallback: number): number {
  if (typeof t !== 'string') return fallback;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return Number.isFinite(h) ? h : fallback;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function construirEstado(e: EntradaEstado): EstadoSueno {
  const { hoy, ahoraMs, config, sesiones } = e;

  // ── Noches: la sesion manda; biometricas_dia rellena los dias sin sesion ──
  // biometricas_dia trae duracion pero no horarios, asi que sirve para la deuda
  // y no para anclar el Proceso C.
  const fechasConSesion = new Set(sesiones.map((s) => s.fecha));
  const minutosBio = new Map<string, number>();
  for (const b of e.biometricas) {
    if (b.sueno_min != null && b.sueno_min > 0 && !fechasConSesion.has(b.fecha)) minutosBio.set(b.fecha, b.sueno_min);
  }
  const noches: NocheSueno[] = [
    ...sesiones.map((s) => ({ fecha: s.fecha, minutos: s.minutos })),
    ...[...minutosBio].map(([fecha, minutos]) => ({ fecha, minutos })),
  ];

  // ── Necesidad y deuda ────────────────────────────────────────────────────
  const necesidadConfig = num(config.necesidad_h, 8);
  const estimada = config.necesidad_auto ? necesidadEstimada(noches) : null;
  const necesidadH = estimada ?? necesidadConfig;
  const deuda = calcularDeuda(noches, necesidadH, hoy);

  // ── Anclas del dia ───────────────────────────────────────────────────────
  const horaDormirCfg = horaDecimal(config.hora_dormir, 23);
  const horaDespertarCfg = horaDecimal(config.hora_despertar, 7);

  // Si ya hay sesion principal de hoy, el despertar REAL manda sobre el
  // configurado: el modelo tiene que describir el dia que esta pasando.
  const principalHoy = sesiones
    .filter((s) => s.fecha === hoy && !s.siesta)
    .sort((a, b) => (a.fin < b.fin ? 1 : -1))[0];
  const despertarMs = principalHoy ? Date.parse(principalHoy.fin) : msDeHoraLocal(hoy, horaDespertarCfg);
  const horaDespertar = horaLocal(despertarMs);
  const dormirAbs = horaDormirCfg <= horaDespertar ? horaDormirCfg + 24 : horaDormirCfg;
  const dormirMs = despertarMs + (dormirAbs - horaDespertar) * H;

  // ── Proceso S acumulado: 14 dias reales ──────────────────────────────────
  // Los dias sin registro se rellenan con una noche tipica en el horario
  // configurado. Dejarlos como vigilia pura llevaria S a 1 y pintaria un dia
  // catastrofico por el solo hecho de no haber medido; asumir la necesidad
  // completa es la misma convencion neutra que usa el calculo de la deuda.
  const simDesdeMs = msDeHoraLocal(restarDias(hoy, DIAS_SIMULACION), 0);
  const episodios: Episodio[] = sesiones
    .filter((s) => Date.parse(s.fin) >= simDesdeMs)
    .map((s) => ({ inicioMs: Date.parse(s.inicio), finMs: Date.parse(s.fin) }));

  // Incluye i = 0 (la noche que termina hoy): sin ella, un dia sin registro
  // dejaria 24 h de vigilia simulada y hundiria la curva sin razon.
  for (let i = DIAS_SIMULACION; i >= 0; i--) {
    const fecha = restarDias(hoy, i);
    if (fechasConSesion.has(fecha)) continue;
    const minutos = minutosBio.get(fecha) ?? necesidadH * 60;
    const finMs = msDeHoraLocal(fecha, horaDespertarCfg);
    episodios.push({ inicioMs: finMs - minutos * 60_000, finMs });
  }

  const sInicial = simularS(episodios, simDesdeMs, despertarMs, sEquilibrioAlDespertar(necesidadH));

  // Siestas ya registradas hoy: entran en la curva del dia.
  const siestasHoy: Episodio[] = sesiones
    .filter((s) => s.siesta && Date.parse(s.inicio) >= despertarMs)
    .map((s) => ({ inicioMs: Date.parse(s.inicio), finMs: Date.parse(s.fin) }));

  const curva = curvaDelDia({
    desdeMs: despertarMs,
    hastaMs: dormirMs + H,
    sInicial,
    horaDespertar,
    tminHora: tminDesdeDespertar(horaDespertar),
    pasoMin: 15,
    episodios: siestasHoy,
  });

  const ventanas = ventanasDelDia(curva, { horaDespertar, horaDormir: horaDormirCfg });
  const siesta = ventanaSiesta(ventanas, {
    deudaH: deuda.horas,
    horaDormir: horaDormirCfg,
    horaDespertar,
    permitida: config.siestas_ok !== false,
  });

  // ── Cafeina ──────────────────────────────────────────────────────────────
  const vidaMedia = num(config.cafeina_vida_media_h, 5.7);
  const umbral = Number(config.cafeina_umbral_mg);
  const umbralMg = Number.isFinite(umbral) && umbral >= 0 ? umbral : 50;
  const dosis: Dosis[] = e.dosis.map((d) => ({ tomadoMs: Date.parse(d.tomado_at), mg: d.mg }));
  const corteMs = horaCorte(dosis, dormirMs, DOSIS_REFERENCIA_MG, umbralMg, vidaMedia);

  // ── Plan ─────────────────────────────────────────────────────────────────
  const plan = planDeuda({
    deudaH: deuda.horas,
    necesidadH,
    objetivoH: num(config.deuda_objetivo_h, 2),
    hoy,
    horaDormir: horaDormirCfg,
    horaDespertar,
    ventanas,
    siesta,
    horaCorteCafeina: corteMs === null ? null : horaLocal(corteMs),
    diasSinDato: deuda.diasSinDato,
  });

  // ── Estado "ahora" ───────────────────────────────────────────────────────
  const dentroDeCurva = ahoraMs >= curva[0].ms && ahoraMs <= curva[curva.length - 1].ms;
  const puntoAhora = dentroDeCurva
    ? curva.reduce((b, p) => (Math.abs(p.ms - ahoraMs) < Math.abs(b.ms - ahoraMs) ? p : b))
    : null;
  const ventanaAhora = puntoAhora
    ? ventanas.find((v) => puntoAhora.hora >= v.desde && puntoAhora.hora <= v.hasta) ?? null
    : null;

  return {
    hoy,
    generado_at: new Date(ahoraMs).toISOString(),
    config,
    necesidad: { horas: necesidadH, origen: estimada !== null ? 'auto' : 'config' },
    deuda,
    anclas: {
      despertar_ms: despertarMs,
      dormir_ms: dormirMs,
      hora_despertar: horaDespertar,
      hora_dormir: horaDormirCfg,
      tmin: tminDesdeDespertar(horaDespertar),
      despertar_real: !!principalHoy,
      s_inicial: Math.round(sInicial * 1000) / 1000,
    },
    curva: curva.map((p) => ({ hora: p.hora, ms: p.ms, alerta: p.alerta })),
    ahora: puntoAhora
      ? { hora: puntoAhora.hora, alerta: puntoAhora.alerta, ventana: ventanaAhora?.clave ?? null }
      : null,
    ventanas,
    siesta,
    cafeina: {
      vida_media_h: vidaMedia,
      umbral_mg: umbralMg,
      mg_ahora: mgActivos(dosis, ahoraMs, vidaMedia),
      mg_al_dormir: mgActivos(dosis, dormirMs, vidaMedia),
      total_hoy_mg: totalDelDia(
        e.dosis.filter((d) => d.fecha === hoy).map((d) => ({ tomadoMs: Date.parse(d.tomado_at), mg: d.mg })),
      ),
      hora_corte: corteMs === null ? null : horaLocal(corteMs),
      dosis: e.dosis,
    },
    // Orden explicito (mas reciente primero): no depender del orden en que
    // llegaron las filas.
    sesiones: sesiones
      .filter((s) => s.fecha >= restarDias(hoy, 13))
      .sort((a, b) => (a.inicio < b.inicio ? 1 : a.inicio > b.inicio ? -1 : 0)),
    plan,
    resumen: resumenPlan(plan),
  };
}
