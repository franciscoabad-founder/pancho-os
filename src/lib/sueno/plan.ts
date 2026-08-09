/**
 * Plan de pago de la deuda de sueno.
 *
 * Esta es la parte que las apps de sueno no dan: te dicen cuanta deuda tienes y
 * te dejan ahi. Un numero que solo sube no es informacion, es culpa con
 * decimales. Aqui la deuda existe para producir un plan con fechas y horas.
 *
 * Reglas de diseno:
 *
 * 1. La deuda se paga en cuotas, no de un golpe. Dormir 12 h un sabado no
 *    devuelve las 12 h perdidas y encima corre el reloj circadiano.
 * 2. Se prefiere adelantar la hora de acostarse antes que estirar el despertar.
 *    El despertar es el ancla del ritmo: moverlo mucho equivale a viajar de zona
 *    horaria sin salir de la casa.
 * 3. Techo de extension por noche: MAX_ADELANTO + MAX_ESTIRAR. Mas que eso el
 *    cuerpo no lo aprovecha y el rebote empeora la noche siguiente.
 * 4. La siesta paga deuda, pero cobra: si cae tarde, se roba la presion de sueno
 *    de esa misma noche. Por eso vive dentro de la ventana del bajon.
 *
 * Modulo puro.
 */

import { formatearHoras, nivelDeuda } from './deuda.ts';
import { formatearHora } from './modelo.ts';
import type { Ventana, VentanaSiesta } from './ventanas.ts';

/** Adelanto maximo de la hora de acostarse, en minutos por noche. */
export const MAX_ADELANTO_MIN = 45;
/** Estiramiento maximo del despertar, en minutos por noche. */
export const MAX_ESTIRAR_MIN = 30;
/** Horizonte del plan. Mas alla de dos semanas ya no es un plan, es un deseo. */
export const MAX_NOCHES_PLAN = 14;

export interface NochePlan {
  n: number;
  fecha: string;
  /** Horas a dormir esa noche. */
  dormirH: number;
  adelantoMin: number;
  estirarMin: number;
  siestaMin: number;
  /** Deuda restante al terminar esa noche. */
  deudaRestanteH: number;
}

export type PrioridadAccion = 1 | 2 | 3;

export interface AccionPlan {
  key: string;
  titulo: string;
  detalle: string;
  /** Hora o rango concreto, cuando la accion lo tiene. */
  cuando?: string;
  prioridad: PrioridadAccion;
}

export interface PlanSueno {
  deudaH: number;
  objetivoH: number;
  nivel: ReturnType<typeof nivelDeuda>;
  /** Noches que toma llegar al objetivo, o null si no se llega en el horizonte. */
  nochesParaObjetivo: number | null;
  noches: NochePlan[];
  acciones: AccionPlan[];
  /** Horario sugerido para esta noche. */
  horarioHoy: { acostarse: string; despertar: string; dormirH: number };
}

export interface ParamsPlan {
  deudaH: number;
  necesidadH: number;
  objetivoH: number;
  /** Fecha de hoy YYYY-MM-DD (la primera noche del plan es la de hoy). */
  hoy: string;
  /** Hora local decimal habitual de acostarse. */
  horaDormir: number;
  /** Hora local decimal habitual de despertar. */
  horaDespertar: number;
  ventanas: Ventana[];
  siesta: VentanaSiesta | null;
  /** Hora local decimal de corte de cafeina, si se pudo calcular. */
  horaCorteCafeina?: number | null;
  /** Dias de la ventana sin ningun registro, para avisar que el numero va corto. */
  diasSinDato?: number;
}

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Simula el pago noche a noche. Cada noche se aplica el adelanto y el
 * estiramiento que hagan falta (sin pasar del techo), mas la siesta si esta
 * habilitada, hasta bajar del objetivo.
 */
export function simularPago(p: {
  deudaH: number;
  necesidadH: number;
  objetivoH: number;
  hoy: string;
  siestaMin: number;
  maxNoches?: number;
}): NochePlan[] {
  const noches: NochePlan[] = [];
  let deuda = p.deudaH;
  const max = p.maxNoches ?? MAX_NOCHES_PLAN;

  for (let n = 1; n <= max && deuda > p.objetivoH; n++) {
    const faltaH = deuda - p.objetivoH;
    const adelantoMin = Math.round(Math.min(MAX_ADELANTO_MIN, faltaH * 60));
    const restante = Math.max(0, faltaH * 60 - adelantoMin);
    const estirarMin = Math.round(Math.min(MAX_ESTIRAR_MIN, restante));
    const siestaMin = deuda - (adelantoMin + estirarMin) / 60 > p.objetivoH ? p.siestaMin : 0;
    const pagoH = (adelantoMin + estirarMin + siestaMin) / 60;
    deuda = Math.round(Math.max(0, deuda - pagoH) * 100) / 100;
    noches.push({
      n,
      fecha: sumarDias(p.hoy, n - 1),
      dormirH: Math.round((p.necesidadH + (adelantoMin + estirarMin) / 60) * 100) / 100,
      adelantoMin,
      estirarMin,
      siestaMin,
      deudaRestanteH: deuda,
    });
  }
  return noches;
}

/** Construye el plan completo: cuotas y acciones concretas. */
export function planDeuda(p: ParamsPlan): PlanSueno {
  const nivel = nivelDeuda(p.deudaH, p.necesidadH);
  const noches = simularPago({
    deudaH: p.deudaH,
    necesidadH: p.necesidadH,
    objetivoH: p.objetivoH,
    hoy: p.hoy,
    siestaMin: p.siesta?.minutos ?? 0,
  });

  const primera = noches[0];
  const acostarse = p.horaDormir - (primera?.adelantoMin ?? 0) / 60;
  const despertar = p.horaDespertar + (primera?.estirarMin ?? 0) / 60;
  const dormirH = primera?.dormirH ?? p.necesidadH;

  const acciones: AccionPlan[] = [];

  if (primera) {
    acciones.push({
      key: 'acostarse',
      titulo:
        primera.adelantoMin > 0
          ? `Acuestate ${primera.adelantoMin} min antes: ${formatearHora(acostarse)}`
          : `Acuestate a tu hora: ${formatearHora(acostarse)}`,
      detalle:
        primera.adelantoMin > 0
          ? 'Adelantar la hora de dormir paga deuda sin mover el ancla del despertar. Es la cuota mas barata que existe.'
          : 'La deuda ya esta cerca del objetivo: sostener el horario vale mas que forzar horas extra.',
      cuando: formatearHora(acostarse),
      prioridad: 1,
    });
    if (primera.estirarMin > 0) {
      acciones.push({
        key: 'despertar',
        titulo: `Despierta ${primera.estirarMin} min mas tarde: ${formatearHora(despertar)}`,
        detalle:
          'Maximo media hora. Mas que eso mueve el reloj circadiano y el lunes se paga con intereses.',
        cuando: formatearHora(despertar),
        prioridad: 2,
      });
    }
  } else {
    acciones.push({
      key: 'mantener',
      titulo: 'Deuda bajo control: sostener, no perseguir el cero',
      detalle: `Mantén el horario de ${formatearHora(p.horaDormir)} a ${formatearHora(p.horaDespertar)}. Una deuda residual pequeña es normal; perseguir el cero produce ansiedad, no descanso.`,
      prioridad: 2,
    });
  }

  if (p.siesta) {
    acciones.push({
      key: 'siesta',
      titulo: `Siesta de ${p.siesta.minutos} min`,
      detalle: p.siesta.motivo,
      cuando: p.siesta.etiqueta,
      prioridad: 2,
    });
  }

  if (p.horaCorteCafeina != null) {
    acciones.push({
      key: 'cafeina',
      titulo: `Ultimo cafe a las ${formatearHora(p.horaCorteCafeina)}`,
      detalle:
        'Despues de esa hora la cafeina todavia esta activa al acostarte. No siempre impide dormir, pero recorta el sueno profundo, que es justo el que paga la deuda.',
      cuando: formatearHora(p.horaCorteCafeina),
      prioridad: nivel === 'saldada' ? 3 : 1,
    });
  }

  const inercia = p.ventanas.find((v) => v.clave === 'inercia');
  if (inercia) {
    acciones.push({
      key: 'luz_manana',
      titulo: 'Luz exterior 10 min al despertar',
      detalle:
        'La luz de la manana adelanta el reloj y adelanta la melatonina de la noche. Es la palanca mas fuerte y la mas barata sobre el Proceso C.',
      cuando: inercia.etiqueta,
      prioridad: 1,
    });
  }

  const pico = p.ventanas.find((v) => v.clave === 'pico_manana');
  if (pico) {
    acciones.push({
      key: 'domino',
      titulo: 'One Domino dentro del pico',
      detalle:
        'La hora de mayor alerta del dia es un recurso, no un accidente. Ahi va lo dificil; el correo y las llamadas caben en el bajon.',
      cuando: pico.etiqueta,
      prioridad: 2,
    });
  }

  const melatonina = p.ventanas.find((v) => v.clave === 'melatonina');
  if (melatonina) {
    acciones.push({
      key: 'luz_noche',
      titulo: 'Luces abajo en la ventana de melatonina',
      detalle:
        'Luz brillante en esta franja retrasa el DLMO y empuja la hora a la que te da sueno. Pantallas al minimo y nada de entreno intenso.',
      cuando: melatonina.etiqueta,
      prioridad: nivel === 'alta' || nivel === 'media' ? 1 : 2,
    });
  }

  acciones.push({
    key: 'consistencia',
    titulo: 'Misma hora de despertar, tambien el fin de semana',
    detalle:
      'Dormir hasta tarde el sabado y el domingo produce jet lag social: el lunes el cuerpo esta dos zonas horarias atras. La consistencia paga mas deuda que cualquier noche heroica.',
    prioridad: 3,
  });

  if ((p.diasSinDato ?? 0) >= 3) {
    acciones.push({
      key: 'registrar',
      titulo: `Faltan ${p.diasSinDato} dias de registro en la ventana`,
      detalle:
        'Los dias sin dato cuentan como neutros, asi que la deuda real es probablemente mayor que la que ves. Registra aunque sea a ojo.',
      prioridad: 2,
    });
  }

  return {
    deudaH: p.deudaH,
    objetivoH: p.objetivoH,
    nivel,
    nochesParaObjetivo: noches.length ? (noches[noches.length - 1].deudaRestanteH <= p.objetivoH ? noches.length : null) : 0,
    noches,
    acciones: acciones.sort((a, b) => a.prioridad - b.prioridad),
    horarioHoy: {
      acostarse: formatearHora(acostarse),
      despertar: formatearHora(despertar),
      dormirH: Math.round(dormirH * 100) / 100,
    },
  };
}

/** Resumen en una linea, para el brief de la manana (Telegram / n8n). */
export function resumenPlan(plan: PlanSueno): string {
  if (!plan.noches.length) {
    return `Deuda de sueno ${formatearHoras(plan.deudaH)}: bajo control. Sostener horario.`;
  }
  const cuando =
    plan.nochesParaObjetivo === null
      ? `no baja del objetivo en ${MAX_NOCHES_PLAN} noches al ritmo actual`
      : `objetivo en ${plan.nochesParaObjetivo} ${plan.nochesParaObjetivo === 1 ? 'noche' : 'noches'}`;
  return `Deuda de sueno ${formatearHoras(plan.deudaH)} (${plan.nivel}). Hoy: dormir ${formatearHoras(plan.horarioHoy.dormirH)}, de ${plan.horarioHoy.acostarse} a ${plan.horarioHoy.despertar}. ${cuando}.`;
}
