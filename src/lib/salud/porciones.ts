// Logica pura de porciones (alimento_porciones) para Nutricion OS. Sin dependencias
// externas (testeable con node:test). Complementa macros.ts: aqui se resuelve la
// conversion porcion -> gramos -> macros para el picker estilo Yazio.

import { calcularMacros, r1, type MacrosPor100g, type MacrosEntrada } from './macros.ts';

export interface AlimentoPorcion {
  nombre: string;
  gramos: number;
}

/**
 * Convierte una cantidad de una porcion (ej. "2 tazas") a gramos.
 * cantidad es el multiplicador (2 tazas = cantidad 2). Cantidades no finitas o
 * negativas se tratan como 0, igual que porcionAGramos en macros.ts.
 */
export function gramosDesdePorcion(porcion: AlimentoPorcion, cantidad: number): number {
  const n = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0;
  return r1((porcion.gramos || 0) * n);
}

/**
 * Calcula los macros de una entrada a partir de los macros por 100 g de un alimento
 * y los gramos ya resueltos (ver gramosDesdePorcion). Delega en calcularMacros: no
 * duplica la logica de proporcion/redondeo.
 */
export function macrosPorPorcion(por100g: MacrosPor100g, gramos: number): MacrosEntrada {
  return calcularMacros(por100g, gramos);
}
