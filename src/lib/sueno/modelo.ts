/**
 * Modelo de dos procesos de regulacion del sueno (Borbely, 1982).
 *
 * Proceso S (homeostatico): presion de sueno que sube durante la vigilia y baja
 * durante el sueno, con dinamica exponencial saturante. Correlato fisiologico:
 * acumulacion y aclaramiento de adenosina.
 *
 * Proceso C (circadiano): oscilacion de ~24 h regulada por el nucleo
 * supraquiasmatico, independiente de cuanto hayas dormido. Se ancla al minimo
 * termico (Tmin), que cae ~2 h antes de la hora habitual de despertar.
 *
 * Alerta(t) = C(t) - pesoS * S(t) - inercia(t). El modelo no mide nada: predice
 * la FORMA del dia. La precision util esta en el orden de las ventanas (cuando
 * es el pico, cuando el bajon), no en el valor absoluto del indice.
 *
 * Todo aqui es puro: sin fetch, sin Supabase, sin Date.now() implicito.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constantes del modelo
// ─────────────────────────────────────────────────────────────────────────────

/** Constante de tiempo de acumulacion de S en vigilia (h). Borbely/Daan-Beersma. */
export const TAU_VIGILIA = 18.2;
/** Constante de tiempo de disipacion de S durante el sueno (h). */
export const TAU_SUENO = 4.2;

/**
 * Segundo armonico del proceso C. Con amplitud 0.5 y su maximo 4.5 h despues del
 * Tmin, el modelo reproduce los cuatro anclajes empiricos de un dia normal
 * (despertar 07:00, Tmin 05:00): pico matutino ~3.6 h post-despertar, bajon de
 * tarde ~8.5 h, segundo aire ~12.3 h, y pico matutino por encima del segundo
 * aire. Estos valores salieron de ajustar la curva contra esos anclajes.
 */
const C_ARMONICO_2 = 0.5;
const C_ARMONICO_2_OFFSET_H = 4.5;

/** Peso relativo de la presion homeostatica frente al drive circadiano. */
export const PESO_S = 1.3;

/** Inercia del sueno: penalizacion al despertar y su vida media de decaimiento. */
export const INERCIA_AMPLITUD = 0.35;
export const INERCIA_TAU_MIN = 45;

/**
 * Ventana de referencia para llevar el indice crudo a 0-100. Son constantes
 * FIJAS a proposito: si se normalizara por dia, un dia con mucha deuda se veria
 * igual de alto que uno descansado y el indice dejaria de comparar.
 */
const CRUDO_MIN = -0.55;
const CRUDO_MAX = 0.45;

/** Ecuador no tiene horario de verano: offset fijo. */
export const OFFSET_TZ_H = -5;

const HORA_MS = 3_600_000;
const W = (2 * Math.PI) / 24;

// ─────────────────────────────────────────────────────────────────────────────
// Proceso S
// ─────────────────────────────────────────────────────────────────────────────

/** S tras `horas` de vigilia partiendo de `s0`. Sube hacia 1 con tau larga. */
export function sVigilia(s0: number, horas: number, tau = TAU_VIGILIA): number {
  if (horas <= 0) return s0;
  return 1 - (1 - s0) * Math.exp(-horas / tau);
}

/** S tras `horas` de sueno partiendo de `s0`. Baja hacia 0 con tau corta. */
export function sSueno(s0: number, horas: number, tau = TAU_SUENO): number {
  if (horas <= 0) return s0;
  return s0 * Math.exp(-horas / tau);
}

/**
 * S de equilibrio al despertar para un patron estable de `horasSueno` por noche.
 * Es el punto fijo de alternar vigilia y sueno; itera hasta converger.
 * Dormir menos de lo necesario sube este piso: eso es, literalmente, la deuda.
 */
export function sEquilibrioAlDespertar(horasSueno: number): number {
  const dormido = Math.min(23.5, Math.max(0.5, horasSueno));
  const despierto = 24 - dormido;
  let s = 0.3;
  for (let i = 0; i < 300; i++) s = sSueno(sVigilia(s, despierto), dormido);
  return s;
}

/** Episodio de sueno en milisegundos epoch. */
export interface Episodio {
  inicioMs: number;
  finMs: number;
}

/**
 * Simula S desde `desdeMs` hasta `hastaMs` alternando vigilia y sueno segun los
 * episodios reales. Los episodios pueden venir desordenados o solaparse: se
 * ordenan y se recortan al rango. Devuelve S al final del rango.
 */
export function simularS(episodios: Episodio[], desdeMs: number, hastaMs: number, s0: number): number {
  let s = s0;
  let cursor = desdeMs;
  const orden = [...episodios]
    .filter((e) => Number.isFinite(e.inicioMs) && Number.isFinite(e.finMs) && e.finMs > e.inicioMs)
    .sort((a, b) => a.inicioMs - b.inicioMs);

  for (const ep of orden) {
    const ini = Math.max(ep.inicioMs, cursor);
    const fin = Math.min(ep.finMs, hastaMs);
    if (fin <= ini) continue;
    if (ini > cursor) s = sVigilia(s, (ini - cursor) / HORA_MS);
    s = sSueno(s, (fin - ini) / HORA_MS);
    cursor = fin;
    if (cursor >= hastaMs) return s;
  }
  if (hastaMs > cursor) s = sVigilia(s, (hastaMs - cursor) / HORA_MS);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Proceso C
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El armonico fundamental tiene su minimo EXACTAMENTE en el Tmin. El segundo
 * armonico, que es el que produce el bajon de tarde y el segundo aire, tambien
 * profundiza el fondo de la madrugada y corre el minimo de la curva compuesta
 * ~1 h antes del Tmin. Se deja asi a proposito: los anclajes diurnos (pico,
 * bajon, segundo aire) son lo que este modelo tiene que acertar, y el fondo
 * nocturno cae igual dentro de la franja real de maxima somnolencia (03:00-05:00).
 */
function cCruda(hora: number, tminHora: number): number {
  return (
    Math.cos(W * (hora - tminHora - 12)) +
    C_ARMONICO_2 * Math.cos(2 * W * (hora - tminHora - C_ARMONICO_2_OFFSET_H))
  );
}

const C_MIN = (() => {
  let m = Infinity;
  for (let i = 0; i < 24000; i++) m = Math.min(m, cCruda((i / 24000) * 24, 0));
  return m;
})();
const C_MAX = (() => {
  let m = -Infinity;
  for (let i = 0; i < 24000; i++) m = Math.max(m, cCruda((i / 24000) * 24, 0));
  return m;
})();

/**
 * Drive circadiano de alerta normalizado a 0-1, para una hora decimal local
 * (0-24) y un Tmin dado. 0 = fondo del valle nocturno, 1 = cresta.
 */
export function procesoC(hora: number, tminHora: number): number {
  return (cCruda(hora, tminHora) - C_MIN) / (C_MAX - C_MIN);
}

/** Tmin (minimo termico): ~2 h antes de la hora habitual de despertar. */
export function tminDesdeDespertar(horaDespertar: number): number {
  return (horaDespertar - 2 + 24) % 24;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inercia del sueno y alerta compuesta
// ─────────────────────────────────────────────────────────────────────────────

/** Penalizacion por inercia del sueno, decae exponencialmente tras despertar. */
export function inercia(minutosDesdeDespertar: number): number {
  if (minutosDesdeDespertar < 0) return 0;
  return INERCIA_AMPLITUD * Math.exp(-minutosDesdeDespertar / INERCIA_TAU_MIN);
}

/** Lleva el indice crudo a la escala 0-100 con la ventana de referencia fija. */
export function escalarAlerta(crudo: number): number {
  const v = ((crudo - CRUDO_MIN) / (CRUDO_MAX - CRUDO_MIN)) * 100;
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}

export interface PuntoCurva {
  /** Hora local decimal (puede pasar de 24 si el dia se extiende a la madrugada). */
  hora: number;
  ms: number;
  alerta: number;
  s: number;
  c: number;
}

export interface ParamsCurva {
  /** Inicio del tramo a dibujar (normalmente el despertar de hoy). */
  desdeMs: number;
  hastaMs: number;
  /** S en `desdeMs`, tipicamente el resultado de simularS sobre el historico. */
  sInicial: number;
  /** Hora local decimal de despertar de hoy (ancla la inercia). */
  horaDespertar: number;
  /** Tmin en hora local decimal. */
  tminHora: number;
  /** Resolucion en minutos. */
  pasoMin?: number;
  /** Siestas planificadas o ya registradas dentro del tramo. */
  episodios?: Episodio[];
}

/**
 * Curva de alerta del dia. Integra S hacia adelante desde `sInicial` respetando
 * las siestas que caigan dentro del tramo.
 */
export function curvaDelDia(p: ParamsCurva): PuntoCurva[] {
  const paso = (p.pasoMin ?? 15) * 60_000;
  const puntos: PuntoCurva[] = [];
  const despertarMs = p.desdeMs;

  for (let ms = p.desdeMs; ms <= p.hastaMs; ms += paso) {
    const s = simularS(p.episodios ?? [], p.desdeMs, ms, p.sInicial);
    const horaAbs = (ms - despertarMs) / HORA_MS + p.horaDespertar;
    const hora = ((horaAbs % 24) + 24) % 24;
    const c = procesoC(hora, p.tminHora);
    const crudo = c - PESO_S * s - inercia(((ms - despertarMs) / 60_000));
    puntos.push({ hora: horaAbs, ms, alerta: escalarAlerta(crudo), s, c });
  }
  return puntos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de hora local (America/Guayaquil, offset fijo)
// ─────────────────────────────────────────────────────────────────────────────

/** Hora local decimal (0-24) de un instante epoch. */
export function horaLocal(ms: number): number {
  const h = ms / HORA_MS + OFFSET_TZ_H;
  return ((h % 24) + 24) % 24;
}

/** Instante epoch de una hora local decimal en una fecha YYYY-MM-DD. */
export function msDeHoraLocal(fechaISO: string, hora: number): number {
  const base = Date.parse(`${fechaISO}T00:00:00${offsetISO()}`);
  return base + hora * HORA_MS;
}

function offsetISO(): string {
  const signo = OFFSET_TZ_H <= 0 ? '-' : '+';
  const abs = Math.abs(OFFSET_TZ_H);
  return `${signo}${String(Math.floor(abs)).padStart(2, '0')}:${String(Math.round((abs % 1) * 60)).padStart(2, '0')}`;
}

/** Formatea una hora decimal como HH:MM (acepta horas > 24, envuelve). */
export function formatearHora(hora: number): string {
  const h = ((hora % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (mm === 60) return `${String((hh + 1) % 24).padStart(2, '0')}:00`;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
