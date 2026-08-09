// Racha diaria de hábitos, respetando días programados (dias_semana). Lógica pura,
// testeable con node:test.

import { addDias, diaIso } from './fechas.ts';

export interface Racha {
  actual: number;
  mejor: number;
}

/**
 * Racha diaria y mejor racha histórica, contando solo días programados
 * (diasSemana, ISO 1=lunes). HOY sin check NO rompe la racha (aún hay tiempo en el
 * día); cualquier otro día programado sin check sí la rompe. Días no programados se
 * ignoran (ni suman ni rompen). Barre desde la fecha hecha más antigua hasta hoy en
 * una sola pasada: el valor final del contador es la racha "actual" (la corrida sin
 * romper que llega hasta hoy) y el máximo visto en el camino es la "mejor".
 */
export function rachaDiaria(fechasHechas: Set<string>, diasSemana: number[], hoy: string): Racha {
  if (!fechasHechas || fechasHechas.size === 0) return { actual: 0, mejor: 0 };

  const fechas = Array.from(fechasHechas).sort();
  let cursor = fechas[0];
  let streak = 0;
  let mejor = 0;
  let guard = 0;

  while (cursor <= hoy && guard < 3660) {
    const programado = diasSemana.includes(diaIso(cursor));
    if (programado) {
      const hecho = fechasHechas.has(cursor);
      if (hecho) {
        streak += 1;
        if (streak > mejor) mejor = streak;
      } else if (cursor !== hoy) {
        streak = 0;
      }
      // cursor === hoy y no hecho: pendiente, no rompe ni suma.
    }
    cursor = addDias(cursor, 1);
    guard += 1;
  }

  return { actual: streak, mejor };
}

/**
 * true si ayer era un día programado y no se hizo el check. Alimenta la alerta
 * "nunca falles dos veces" (Atomic Habits / regla canonizada de Pancho).
 */
export function falloAyer(fechasHechas: Set<string>, diasSemana: number[], hoy: string): boolean {
  const ayer = addDias(hoy, -1);
  if (!diasSemana.includes(diaIso(ayer))) return false;
  return !fechasHechas.has(ayer);
}
