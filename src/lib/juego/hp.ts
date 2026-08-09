// HP del motor transversal (Version B). Solo las diarias core hacen dano; loss aversion
// dosificada (Kahneman): perder duele, pero no en todo. Logica pura, testeable.

import { multiplicadorDificultad, type Dificultad } from '../habitos/scoring.ts';

const round = (n: number) => Math.round(n);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Dano HP por fallar una diaria core: 2..6, escalado por dificultad y por que tan
 * fuerte estaba el habito (valor alto = mas dano, perder una racha fuerte duele mas).
 */
export function danioPorFallo(dificultad: Dificultad, valor: number): number {
  const v = Number.isFinite(valor) ? valor : 0;
  const mult = multiplicadorDificultad(dificultad);
  // Base 2, escala con dificultad (hasta 2x) y con valor positivo (hasta +2 mas si
  // el valor es alto). Clamp final 2..6.
  const porValor = clamp(v, 0, 10) / 10; // 0..1
  const danio = 2 * mult + 2 * porValor;
  return clamp(round(danio), 2, 6);
}

export interface ResultadoMuerte {
  oroPerdido: number;
  hpNuevo: number;
}

/** HP llega a 0: pierde 50% del oro (redondeado), HP se restaura al maximo. */
export function aplicarMuerte(oro: number, hpMax: number): ResultadoMuerte {
  const o = Number.isFinite(oro) && oro > 0 ? oro : 0;
  return { oroPerdido: round(o * 0.5), hpNuevo: hpMax };
}

/** Fresh start (Milkman): lunes resetea HP al maximo. */
export function freshStart(hpMax: number): number {
  return hpMax;
}
