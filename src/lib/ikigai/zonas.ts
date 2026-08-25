// Clasificacion de una zona de vida segun que cuadrantes del ikigai satisface.
// El diagrama clasico nombra 4 intersecciones de 2 cuadrantes cada una, mas el
// centro (los 4 a la vez). Una zona con 1 solo cuadrante o con una
// combinacion de 3 no tiene nombre canonico, se marca 'parcial'.

import type { Cuadrante } from './cuadrantes.ts';

export type Clasificacion =
  | 'ikigai'      // 4 cuadrantes: el centro
  | 'pasion'      // amas + bueno
  | 'mision'      // amas + mundo
  | 'profesion'   // bueno + pagan
  | 'vocacion'    // mundo + pagan
  | 'parcial'     // 1 o 3 cuadrantes, o una pareja no canonica (ej amas+pagan)
  | 'vacio';      // 0 cuadrantes

const PAREJAS_CANONICAS: Record<string, Clasificacion> = {
  'amas,bueno': 'pasion',
  'amas,mundo': 'mision',
  'bueno,pagan': 'profesion',
  'mundo,pagan': 'vocacion',
};

/** Clasifica una zona por el conjunto de cuadrantes que declara satisfacer. */
export function clasificar(cuadrantes: Cuadrante[]): Clasificacion {
  const unicos = Array.from(new Set(cuadrantes)).sort();
  if (unicos.length === 0) return 'vacio';
  if (unicos.length === 4) return 'ikigai';
  if (unicos.length === 2) {
    const key = unicos.join(',');
    return PAREJAS_CANONICAS[key] ?? 'parcial';
  }
  return 'parcial';
}
