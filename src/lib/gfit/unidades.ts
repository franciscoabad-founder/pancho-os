// Conversión y formateo de peso para el módulo GFIT. La base de datos SIEMPRE
// guarda peso_kg (canónico); la UI muestra/recibe en la unidad preferida del
// usuario (salud_config.unidad_peso, check 'kg'|'lb'). Toda conversión pasa por aquí.

export type UnidadPeso = 'kg' | 'lb';

export const KG_POR_LB = 0.45359237;

/** Redondea a 2 decimales, evitando artefactos de punto flotante (60.099999 -> 60.1). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Redondea `valor` al múltiplo de `step` más cercano (ej. step 0.25 -> 60.1 => 60). */
function roundToStep(valor: number, step: number): number {
  return Math.round(valor / step) * step;
}

/** kg -> lbs. */
export function kgALbs(kg: number): number {
  return kg / KG_POR_LB;
}

/** lbs -> kg. */
export function lbsAKg(lbs: number): number {
  return lbs * KG_POR_LB;
}

/**
 * Peso canónico (kg) formateado para mostrar en la unidad preferida:
 * kg redondeado a pasos de 0.25, lbs redondeado a pasos de 0.5.
 */
export function formatearPeso(pesoKg: number, unidad: UnidadPeso): number {
  const p = Number(pesoKg) || 0;
  if (unidad === 'lb') {
    return round2(roundToStep(kgALbs(p), 0.5));
  }
  return round2(roundToStep(p, 0.25));
}

/**
 * Convierte un valor ingresado por el usuario (en su unidad preferida) al
 * peso_kg canónico que se guarda en gfit_series_plan / gfit_sesion_series.
 */
export function pesoDesdeInput(valor: number, unidad: UnidadPeso): number {
  const v = Number(valor) || 0;
  if (unidad === 'lb') return round2(lbsAKg(v));
  return round2(v);
}
