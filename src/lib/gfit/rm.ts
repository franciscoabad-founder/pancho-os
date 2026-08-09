// Estimación de 1RM (una repetición máxima) para el módulo GFIT.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Fórmula de Epley: peso × (1 + reps/30). Válida para cualquier rango de reps. */
export function epley(pesoKg: number, reps: number): number {
  const p = Number(pesoKg) || 0;
  const r = Number(reps) || 0;
  if (p <= 0) return 0;
  return round2(p * (1 + r / 30));
}

/**
 * Fórmula de Brzycki: peso × 36 / (37 - reps). Pierde precisión en reps altas,
 * por eso se limita a series de fuerza/hipertrofia real (reps 1-11).
 * Devuelve null si reps >= 12 o reps < 1 (fuera de rango válido de la fórmula).
 */
export function brzycki(pesoKg: number, reps: number): number | null {
  const r = Number(reps) || 0;
  if (r < 1 || r >= 12) return null;
  const p = Number(pesoKg) || 0;
  if (p <= 0) return 0;
  return round2((p * 36) / (37 - r));
}

/**
 * Estimación de 1RM: Epley por defecto. En reps bajas (<=6), donde Brzycki es
 * más confiable, se promedia con Epley para suavizar el sesgo de cada fórmula.
 */
export function estimar1RM(pesoKg: number, reps: number): number {
  const e = epley(pesoKg, reps);
  const r = Number(reps) || 0;
  if (r <= 6) {
    const b = brzycki(pesoKg, reps);
    if (b != null) return round2((e + b) / 2);
  }
  return e;
}
