// Loot variable (variable rewards, dosificado): probabilidad base baja, sube con
// racha, tope. Logica pura, testeable con node:test. rng inyectable para determinismo.

const round = (n: number) => Math.round(n);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const PROB_BASE = 0.08;
const PROB_POR_RACHA = 0.004;
const RACHA_TOPE = 30;

const MENSAJES = [
  'Encontraste una moneda perdida en el bolsillo de ayer.',
  'El sistema te premia por seguir presente.',
  'Botin inesperado: alguien en el pasado te dejo esto.',
  'Un pequeno bono por no rendirte hoy.',
  'La racha rinde frutos: loot desbloqueado.',
  'Sorpresa: el terminal te transfiere oro extra.',
];

export interface Loot {
  oro: number;
  mensaje: string;
}

/**
 * Probabilidad de loot para una racha dada: base 8% + 0.4% por dia de racha,
 * con tope en racha=30 (max ~20%).
 */
export function probabilidadLoot(racha: number): number {
  const r = clamp(Number.isFinite(racha) ? racha : 0, 0, RACHA_TOPE);
  return PROB_BASE + r * PROB_POR_RACHA;
}

/**
 * Tira el dado de loot. rng debe devolver [0,1). Si cae dentro de la probabilidad,
 * devuelve {oro, mensaje}; si no, null. El oro (5-25) tambien se deriva del mismo rng
 * inyectado para que el resultado sea completamente determinista en tests.
 */
export function tirarLoot(rng: () => number, ctx: { racha: number }): Loot | null {
  const prob = probabilidadLoot(ctx.racha);
  const tiro = rng();
  if (tiro >= prob) return null;

  // Reusa el mismo tiro (normalizado dentro del rango de probabilidad) para derivar
  // el monto y el mensaje: determinista con rng constante, variado con rng real.
  const proporcion = prob > 0 ? tiro / prob : 0;
  const oro = round(5 + proporcion * 20); // 5..25
  const mensaje = MENSAJES[clamp(round(proporcion * (MENSAJES.length - 1)), 0, MENSAJES.length - 1)];

  return { oro, mensaje };
}
