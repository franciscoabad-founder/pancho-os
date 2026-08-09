// Lógica pura de macros para Salud OS. Sin dependencias externas (testeable con node:test).

export interface MacrosPor100g {
  kcal: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  fibra_g?: number | null;
}

export interface MacrosEntrada {
  kcal: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  fibra_g: number | null;
}

export interface Porcion {
  medida: string;
  gramos: number;
}

/** Redondea a un decimal para evitar ruido de coma flotante. */
export function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Calcula los macros de una entrada a partir de los macros por 100 g de un alimento
 * y la cantidad consumida en gramos. Devuelve valores redondeados a 1 decimal.
 * Cantidades negativas o no finitas se tratan como 0.
 */
export function calcularMacros(por100g: MacrosPor100g, cantidad_g: number): MacrosEntrada {
  const g = Number.isFinite(cantidad_g) && cantidad_g > 0 ? cantidad_g : 0;
  const factor = g / 100;
  const fibra = por100g.fibra_g;
  return {
    kcal: r1((por100g.kcal || 0) * factor),
    proteina_g: r1((por100g.proteina_g || 0) * factor),
    carbos_g: r1((por100g.carbos_g || 0) * factor),
    grasa_g: r1((por100g.grasa_g || 0) * factor),
    fibra_g: fibra == null ? null : r1((fibra || 0) * factor),
  };
}

/**
 * Convierte una cantidad expresada en una medida de porción a gramos.
 * Ej: 2 "tazas" con porcion {medida:"1 taza", gramos:158} => 316 g.
 */
export function porcionAGramos(porcion: Porcion, cantidadMedidas: number): number {
  const n = Number.isFinite(cantidadMedidas) && cantidadMedidas > 0 ? cantidadMedidas : 0;
  return r1((porcion.gramos || 0) * n);
}

/** Suma una lista de entradas de macros en un total. */
export function sumarMacros(entradas: Array<Partial<MacrosEntrada> | null | undefined>): MacrosEntrada {
  const acc: MacrosEntrada = { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, fibra_g: 0 };
  for (const e of entradas) {
    if (!e) continue;
    acc.kcal = r1(acc.kcal + (Number(e.kcal) || 0));
    acc.proteina_g = r1(acc.proteina_g + (Number(e.proteina_g) || 0));
    acc.carbos_g = r1(acc.carbos_g + (Number(e.carbos_g) || 0));
    acc.grasa_g = r1(acc.grasa_g + (Number(e.grasa_g) || 0));
    acc.fibra_g = r1((acc.fibra_g || 0) + (Number(e.fibra_g) || 0));
  }
  return acc;
}

export type TipoDia = 'normal' | 'leg_day' | 'refeed' | 'keto_light' | 'keto';

export interface TargetDia {
  kcal_min: number;
  kcal_max: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g_min: number;
  grasa_g_max: number;
}

/**
 * Resuelve el target de un tipo de día a partir del objeto ajustes_tipo_dia de salud_config.
 * Cae al target 'normal' si el tipo no existe.
 */
export function targetParaTipoDia(
  ajustes: Record<string, Partial<TargetDia>> | null | undefined,
  tipo: TipoDia,
  base: TargetDia
): TargetDia {
  const t = ajustes?.[tipo] ?? ajustes?.['normal'] ?? {};
  return {
    kcal_min: t.kcal_min ?? base.kcal_min,
    kcal_max: t.kcal_max ?? base.kcal_max,
    proteina_g: t.proteina_g ?? base.proteina_g,
    carbos_g: t.carbos_g ?? base.carbos_g,
    grasa_g_min: t.grasa_g_min ?? base.grasa_g_min,
    grasa_g_max: t.grasa_g_max ?? base.grasa_g_max,
  };
}

/** Porcentaje de avance (0-100+) de un valor contra su target, cap opcional. */
export function pctTarget(actual: number, target: number, cap = 999): number {
  if (!target || target <= 0) return 0;
  return Math.min(cap, Math.round((actual / target) * 100));
}
