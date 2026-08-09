// Score EMA (media móvil exponencial) de consistencia de hábitos, estilo Loop Habit
// Tracker. Lógica pura, testeable con node:test.

import { addDias, diaIso } from './fechas.ts';

export interface DiaCheck {
  fecha: string; // YYYY-MM-DD
  hecho: boolean;
}

/** Factor de suavizado: media vida de 13 checks (fallar 1 día tras muchos hechos apenas baja). */
const F = Math.pow(0.5, 1 / 13);

/**
 * Score EMA de consistencia: s = s_prev * f + hecho·(1 - f), arrancando en s=0.
 * Espera `dias` en orden cronológico (más antiguo primero). Devuelve un valor 0..1.
 */
export function scoreEma(dias: DiaCheck[]): number {
  let s = 0;
  for (const dia of dias ?? []) {
    const hecho = dia.hecho ? 1 : 0;
    s = s * F + hecho * (1 - F);
  }
  return s;
}

/**
 * Genera la lista de días programados (según diasSemana, ISO 1=lunes) entre `desde`
 * y `hoy` (ambos inclusive), marcando cuáles están hechos según `fechasHechas`.
 * Esta es la entrada natural para scoreEma.
 */
export function diasProgramados(
  desde: string,
  hoy: string,
  diasSemana: number[],
  fechasHechas: Set<string>,
): DiaCheck[] {
  const dias: DiaCheck[] = [];
  let cursor = desde;
  let guard = 0;
  while (cursor <= hoy && guard < 3660) {
    if (diasSemana.includes(diaIso(cursor))) {
      dias.push({ fecha: cursor, hecho: fechasHechas.has(cursor) });
    }
    cursor = addDias(cursor, 1);
    guard += 1;
  }
  return dias;
}
