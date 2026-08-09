// Evaluación de criterios de etapa de journeys (Fabulous-style). Lógica pura,
// testeable con node:test.

import { addDias } from './fechas.ts';

export interface Criterio {
  tipo: 'checks';
  habito_nombre?: string;
  habito_id?: string;
  meta: number;
  ventana_dias: number;
}

export interface ResultadoEtapa {
  cumplida: boolean;
  progreso: number; // 0..1
  hechos: number;
}

/**
 * Evalúa si se cumplió el criterio de una etapa de journey: cuenta los checks del
 * hábito dentro de la ventana móvil [hoy - ventana_dias + 1, hoy] (ambos bordes
 * inclusive) y compara contra la meta.
 */
export function evaluarEtapa(
  criterio: Criterio,
  checks: Array<{ habito_id: string; fecha: string }>,
  hoy: string,
  habitoId: string,
): ResultadoEtapa {
  const ventana = criterio.ventana_dias > 0 ? criterio.ventana_dias : 1;
  const desde = addDias(hoy, -(ventana - 1));

  const hechos = (checks ?? []).filter(
    (c) => c.habito_id === habitoId && c.fecha >= desde && c.fecha <= hoy,
  ).length;

  const meta = criterio.meta > 0 ? criterio.meta : 1;
  const progreso = Math.min(1, Math.max(0, hechos / meta));

  return { cumplida: hechos >= criterio.meta, progreso, hechos };
}
