// Tendencia de una zona a partir de sus ultimos N pulsos mensuales (1-5).
// Comparacion simple de la mitad reciente contra la mitad anterior: no hace
// falta regresion lineal para una senal de "sube/baja/plano" mensual.

export interface Pulso {
  periodo: string; // 'YYYY-MM'
  nivel: number;   // 1-5
}

export type Tendencia = 'sube' | 'baja' | 'plano' | 'sin_datos';

const UMBRAL = 0.4; // diferencia minima de promedio para no considerarse "plano"

/** Ordena por periodo ascendente y compara el promedio de la segunda mitad
 *  contra la primera. Con menos de 2 pulsos no hay tendencia posible. */
export function tendencia(pulsos: Pulso[], ventana = 6): Tendencia {
  const ordenados = [...pulsos].sort((a, b) => a.periodo.localeCompare(b.periodo)).slice(-ventana);
  if (ordenados.length < 2) return 'sin_datos';

  const mitad = Math.floor(ordenados.length / 2);
  const primera = ordenados.slice(0, mitad);
  const segunda = ordenados.slice(mitad);
  const promedio = (arr: Pulso[]) => arr.reduce((s, p) => s + p.nivel, 0) / arr.length;

  const diff = promedio(segunda) - promedio(primera);
  if (Math.abs(diff) < UMBRAL) return 'plano';
  return diff > 0 ? 'sube' : 'baja';
}
