// Scoring de hábitos (Habitica reimplementado: task value, XP/oro, anti-farming).
// Lógica pura, testeable con node:test.

export type Dificultad = 'trivial' | 'facil' | 'media' | 'dificil';

const MULTIPLICADORES: Record<Dificultad, number> = {
  trivial: 0.5,
  facil: 1,
  media: 1.5,
  dificil: 2,
};

const round = (n: number) => Math.round(n);

/** Multiplicador de XP/oro/valor según la dificultad declarada del hábito. */
export function multiplicadorDificultad(dificultad: Dificultad): number {
  return MULTIPLICADORES[dificultad] ?? 1;
}

/**
 * Factor de rendimientos decrecientes según el task value acumulado (anti-farming):
 * valores altos (muy hecho) bajan el factor de recompensa; valores muy negativos
 * (muy fallado) lo suben, como bonus de recuperación. Clamp [0.4, 2.5].
 */
export function factorValor(valor: number): number {
  const v = Number.isFinite(valor) ? valor : 0;
  const f = Math.exp(-0.03 * v);
  return Math.min(2.5, Math.max(0.4, f));
}

/**
 * Nuevo task value tras un check: 'mas' suma el multiplicador de dificultad,
 * 'menos' lo resta (empuja hacia negativo).
 */
export function nuevoValor(valor: number, signo: 'mas' | 'menos', dificultad: Dificultad): number {
  const v = Number.isFinite(valor) ? valor : 0;
  const mult = multiplicadorDificultad(dificultad);
  return signo === 'mas' ? v + mult : v - mult;
}

export interface Recompensa {
  xp: number;
  oro: number;
}

/**
 * XP y oro otorgados por un check positivo. Base 10 XP / 5 oro, escalado por
 * dificultad y por el factor anti-farming del valor actual. Mínimo 1 en cada uno.
 */
export function recompensaCheck(valor: number, dificultad: Dificultad): Recompensa {
  const mult = multiplicadorDificultad(dificultad);
  const factor = factorValor(valor);
  const xp = Math.max(1, round(10 * mult * factor));
  const oro = Math.max(1, round(5 * mult * factor));
  return { xp, oro };
}

/**
 * Nuevo valor tras fallar una diaria: empuja hacia negativo, mismo delta que
 * nuevoValor(valor, 'menos', dificultad).
 */
export function penalizacionFallo(valor: number, dificultad: Dificultad): number {
  return nuevoValor(valor, 'menos', dificultad);
}
