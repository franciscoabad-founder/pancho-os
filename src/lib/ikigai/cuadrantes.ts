// Cuadrantes del Ikigai clasico: amas, en lo que eres bueno, por lo que te
// pagan, lo que el mundo necesita. Este archivo es la unica fuente de verdad
// del enum, compartida por handlers, componente y tests.

export const CUADRANTES = ['amas', 'bueno', 'pagan', 'mundo'] as const;
export type Cuadrante = (typeof CUADRANTES)[number];

export const LABEL_CUADRANTE: Record<Cuadrante, string> = {
  amas: 'Lo que amo',
  bueno: 'En lo que soy bueno',
  pagan: 'Por lo que me pagan',
  mundo: 'Lo que el mundo necesita',
};

export function esCuadrante(v: unknown): v is Cuadrante {
  return typeof v === 'string' && (CUADRANTES as readonly string[]).includes(v);
}
