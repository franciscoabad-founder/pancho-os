// Cobertura: por cada cuadrante, cuantas zonas lo satisfacen. Un cuadrante en
// 0 es el hueco real -- la unica pregunta que el diagnostico necesita
// contestar sin depender de que el usuario "sienta" si vive su ikigai.

import { CUADRANTES, type Cuadrante } from './cuadrantes.ts';

export interface ZonaCobertura {
  cuadrantes: Cuadrante[];
}

export interface Cobertura {
  porCuadrante: Record<Cuadrante, number>;
  huecos: Cuadrante[];
}

export function cobertura(zonas: ZonaCobertura[]): Cobertura {
  const porCuadrante = Object.fromEntries(CUADRANTES.map((c) => [c, 0])) as Record<Cuadrante, number>;
  for (const zona of zonas) {
    for (const c of zona.cuadrantes) {
      if (c in porCuadrante) porCuadrante[c] += 1;
    }
  }
  const huecos = CUADRANTES.filter((c) => porCuadrante[c] === 0);
  return { porCuadrante, huecos };
}
