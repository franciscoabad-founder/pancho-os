/**
 * Ventanas del dia derivadas de la curva de alerta.
 *
 * No son horarios fijos de tabla: se leen de la curva que produjo el modelo para
 * ESTE dia, con ESTA deuda y ESTE horario de despertar. Por eso se mueven cuando
 * el dia se mueve.
 *
 * Modulo puro.
 */

import { formatearHora, type PuntoCurva } from './modelo.ts';

export type ClaveVentana =
  | 'inercia'
  | 'pico_manana'
  | 'bajon_tarde'
  | 'segundo_aire'
  | 'melatonina'
  | 'sueno';

export interface Ventana {
  clave: ClaveVentana;
  nombre: string;
  /** Horas decimales absolutas desde medianoche del dia de despertar (puede pasar de 24). */
  desde: number;
  hasta: number;
  /** Instante del extremo (pico o valle) si aplica. */
  pico?: number;
  /** Alerta en el extremo, 0-100. */
  alerta?: number;
  etiqueta: string;
  queHacer: string;
}

/** Duracion tipica de la inercia del sueno. */
export const INERCIA_MIN = 90;

/** Una siesta debe terminar al menos estas horas antes de acostarse. */
export const SIESTA_MARGEN_H = 7;

/** La melatonina empieza a subir ~2 h antes de la hora habitual de dormir (DLMO). */
export const DLMO_ANTES_H = 2;

interface Extremo {
  hora: number;
  alerta: number;
}

function extremo(curva: PuntoCurva[], desde: number, hasta: number, tipo: 'max' | 'min'): Extremo | null {
  const tramo = curva.filter((p) => p.hora >= desde && p.hora <= hasta);
  if (!tramo.length) return null;
  const best = tramo.reduce((b, p) =>
    tipo === 'max' ? (p.alerta > b.alerta ? p : b) : (p.alerta < b.alerta ? p : b),
  );
  return { hora: best.hora, alerta: best.alerta };
}

export interface OpcionesVentanas {
  /** Hora local decimal de despertar de hoy. */
  horaDespertar: number;
  /** Hora local decimal objetivo de acostarse (puede ser > 24 si pasa medianoche). */
  horaDormir: number;
}

/**
 * Deriva las ventanas del dia. La curva debe empezar en el despertar y terminar
 * en (o despues de) la hora de dormir.
 */
export function ventanasDelDia(curva: PuntoCurva[], opts: OpcionesVentanas): Ventana[] {
  const { horaDespertar } = opts;
  const dormir = opts.horaDormir <= horaDespertar ? opts.horaDormir + 24 : opts.horaDormir;
  const ventanas: Ventana[] = [];

  const finInercia = horaDespertar + INERCIA_MIN / 60;
  ventanas.push({
    clave: 'inercia',
    nombre: 'Inercia del sueno',
    desde: horaDespertar,
    hasta: finInercia,
    etiqueta: `${formatearHora(horaDespertar)} a ${formatearHora(finInercia)}`,
    queHacer:
      'Groggy por diseno, no por falta de caracter. Luz exterior 10 min, agua, movimiento. Nada de decisiones ni de la primera dosis de cafeina todavia.',
  });

  const pico = extremo(curva, finInercia, Math.min(dormir, horaDespertar + 7), 'max');
  if (pico) {
    ventanas.push({
      clave: 'pico_manana',
      nombre: 'Pico de enfoque',
      desde: Math.max(finInercia, pico.hora - 1.5),
      hasta: Math.min(dormir, pico.hora + 1.5),
      pico: pico.hora,
      alerta: pico.alerta,
      etiqueta: `${formatearHora(Math.max(finInercia, pico.hora - 1.5))} a ${formatearHora(Math.min(dormir, pico.hora + 1.5))}`,
      queHacer: 'La mejor hora del dia para el trabajo dificil. Aqui va el One Domino, no el correo.',
    });
  }

  const arranqueBajon = pico ? pico.hora + 0.5 : horaDespertar + 6;
  const bajon = extremo(curva, arranqueBajon, Math.min(dormir - 2, horaDespertar + 11), 'min');
  if (bajon) {
    ventanas.push({
      clave: 'bajon_tarde',
      nombre: 'Bajon de tarde',
      desde: Math.max(arranqueBajon, bajon.hora - 1),
      hasta: Math.min(dormir, bajon.hora + 1),
      pico: bajon.hora,
      alerta: bajon.alerta,
      etiqueta: `${formatearHora(Math.max(arranqueBajon, bajon.hora - 1))} a ${formatearHora(Math.min(dormir, bajon.hora + 1))}`,
      queHacer:
        'El valle es circadiano: pasa aunque hayas dormido bien. Tareas mecanicas, caminar, o siesta corta si la deuda lo pide.',
    });
  }

  const arranqueAire = bajon ? bajon.hora + 0.5 : horaDespertar + 10;
  const aire = extremo(curva, arranqueAire, dormir - 1.5, 'max');
  if (aire) {
    ventanas.push({
      clave: 'segundo_aire',
      nombre: 'Segundo aire',
      desde: Math.max(arranqueAire, aire.hora - 1),
      hasta: Math.min(dormir, aire.hora + 1),
      pico: aire.hora,
      alerta: aire.alerta,
      etiqueta: `${formatearHora(Math.max(arranqueAire, aire.hora - 1))} a ${formatearHora(Math.min(dormir, aire.hora + 1))}`,
      queHacer:
        'Zona de mantenimiento de vigilia: el reloj empuja hacia arriba justo antes de la noche. Sirve para ejecutar, no para acostarse temprano a la fuerza.',
    });
  }

  const dlmo = dormir - DLMO_ANTES_H;
  ventanas.push({
    clave: 'melatonina',
    nombre: 'Ventana de melatonina',
    desde: dlmo,
    hasta: dormir,
    etiqueta: `${formatearHora(dlmo)} a ${formatearHora(dormir)}`,
    queHacer: 'Baja las luces, pantallas al minimo, nada de cafeina ni entreno fuerte. Aqui se decide a que hora te duermes de verdad.',
  });

  ventanas.push({
    clave: 'sueno',
    nombre: 'Ventana de sueno',
    desde: dormir - 0.5,
    hasta: dormir + 1,
    etiqueta: `${formatearHora(dormir - 0.5)} a ${formatearHora(dormir + 1)}`,
    queHacer: 'La puerta se abre aqui. Pasarse de largo despierta el segundo aire otra vez y empuja todo el dia siguiente.',
  });

  return ventanas;
}

export interface VentanaSiesta {
  desde: number;
  hasta: number;
  minutos: number;
  etiqueta: string;
  motivo: string;
}

/**
 * Ventana de siesta recomendada, o null si no toca.
 *
 * Reglas: solo si hay deuda que justifique perder tiempo despierto, centrada en
 * el bajon circadiano, y terminando al menos SIESTA_MARGEN_H antes de acostarse
 * para no descargar la presion de sueno que necesitas esa noche.
 */
export function ventanaSiesta(
  ventanas: Ventana[],
  opts: { deudaH: number; horaDormir: number; horaDespertar: number; permitida: boolean },
): VentanaSiesta | null {
  if (!opts.permitida || opts.deudaH < 2) return null;
  const bajon = ventanas.find((v) => v.clave === 'bajon_tarde');
  if (!bajon?.pico) return null;

  const dormir = opts.horaDormir <= opts.horaDespertar ? opts.horaDormir + 24 : opts.horaDormir;
  const limite = dormir - SIESTA_MARGEN_H;
  // Siesta corta (20 min) por defecto: recupera alerta sin entrar en sueno
  // profundo. Solo con deuda alta vale un ciclo completo de 90 min.
  const minutos = opts.deudaH >= 8 ? 90 : 20;
  let desde = bajon.pico - minutos / 120; // centrada en el fondo del valle
  let hasta = desde + minutos / 60;

  if (hasta > limite) {
    // Se puede adelantar un poco para respetar el margen, pero no arrancarla del
    // valle: una siesta fuera del bajon cuesta mas alerta de la que devuelve.
    const corrimiento = hasta - limite;
    if (corrimiento > 1.5) return null;
    desde -= corrimiento;
    hasta -= corrimiento;
  }
  if (desde <= opts.horaDespertar + 4) return null;

  return {
    desde,
    hasta,
    minutos,
    etiqueta: `${formatearHora(desde)} a ${formatearHora(hasta)}`,
    motivo:
      minutos === 20
        ? 'Siesta de 20 min en el valle: baja la presion de sueno lo justo, sin inercia al despertar.'
        : 'Ciclo completo de 90 min: con esta deuda vale el ciclo entero, y se despierta al final del ciclo, no en medio.',
  };
}
