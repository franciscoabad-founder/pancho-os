// Apertura de red segun el Leader Network Diagnostic de Phil Willburn: el
// IDEAL es un punto MEDIO de la escala, no un extremo. Una red demasiado
// abierta (nadie se conoce entre si) no tiene cohesion; una demasiado cerrada
// (todos se conocen) no trae informacion nueva. Ninguna de las dos es buena.

// Densidad del grafo: proporcion de conexiones reales sobre las posibles.
// Con 0 o 1 persona no hay pares posibles, se define 0 para no dividir por 0.
export function densidad(nPersonas: number, nConexiones: number): number {
  if (nPersonas < 2) return 0;
  const maxPosibles = (nPersonas * (nPersonas - 1)) / 2;
  if (maxPosibles === 0) return 0;
  const d = nConexiones / maxPosibles;
  return Math.max(0, Math.min(1, d));
}

export type Banda =
  | 'muy-abierta'
  | 'abierta'
  | 'ideal'
  | 'algo-cerrada'
  | 'cerrada'
  | 'muy-cerrada';

// 6 bandas simetricas alrededor de un centro ideal en 0.5. El nombre de cada
// banda importa mas que el numero: la UI debe leerse como "estas cerca o
// lejos del medio", no como una nota de examen.
const CORTES: Array<{ hasta: number; banda: Banda }> = [
  { hasta: 0.15, banda: 'muy-abierta' },
  { hasta: 0.35, banda: 'abierta' },
  { hasta: 0.65, banda: 'ideal' },
  { hasta: 0.85, banda: 'algo-cerrada' },
  { hasta: 0.95, banda: 'cerrada' },
  { hasta: 1.01, banda: 'muy-cerrada' },
];

export function banda(d: number): Banda {
  const clamped = Math.max(0, Math.min(1, d));
  for (const corte of CORTES) {
    if (clamped <= corte.hasta) return corte.banda;
  }
  return 'muy-cerrada';
}

/** Distancia al ideal (0.5), con signo: negativo = muy abierta, positivo =
 *  muy cerrada. Sirve para dibujar la posicion del marcador en la escala. */
export function distanciaAlIdeal(d: number): number {
  return Math.max(0, Math.min(1, d)) - 0.5;
}
