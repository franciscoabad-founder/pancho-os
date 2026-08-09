// Curva de nivel/XP del motor de juego del OS. Lógica pura, testeable con node:test.
// Compartida entre el módulo Hábitos (A) y el motor transversal (B).

const round = (n: number) => Math.round(n);

/**
 * XP acumulado necesario para ALCANZAR el nivel `n`. Nivel 1 siempre son 0 XP (arranque).
 * Para n >= 2: round(50 * n^1.75).
 */
export function xpParaNivel(n: number): number {
  if (!Number.isFinite(n) || n <= 1) return 0;
  return round(50 * Math.pow(n, 1.75));
}

export interface NivelInfo {
  nivel: number;
  xpEnNivel: number;
  xpSiguiente: number;
  progreso: number; // 0..1
}

/**
 * Deriva el nivel actual a partir del XP total acumulado, más el progreso dentro del
 * nivel (para la barra de XP). XP negativo o inválido => nivel 1, progreso 0.
 */
export function nivelDesdeXp(xpTotal: number): NivelInfo {
  const xp = Number.isFinite(xpTotal) && xpTotal > 0 ? xpTotal : 0;

  let nivel = 1;
  while (xpParaNivel(nivel + 1) <= xp) {
    nivel += 1;
  }

  const base = xpParaNivel(nivel);
  const siguiente = xpParaNivel(nivel + 1);
  const xpEnNivel = xp - base;
  const xpSiguiente = siguiente - base;
  const progreso = xpSiguiente > 0 ? Math.min(1, Math.max(0, xpEnNivel / xpSiguiente)) : 0;

  return { nivel, xpEnNivel, xpSiguiente, progreso };
}
