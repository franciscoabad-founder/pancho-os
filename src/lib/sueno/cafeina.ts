/**
 * Cafeina: decaimiento exponencial y hora de corte.
 *
 * La cafeina bloquea los receptores de adenosina. No borra el Proceso S, lo
 * enmascara: la presion sigue acumulandose y vuelve completa cuando el efecto
 * cae. Por eso el modelo la trata como un velo sobre la curva, nunca como una
 * reduccion de la deuda.
 *
 * Vida media tipica en adultos: 5-6 h, con rango real de 2 a 12 h segun el
 * CYP1A2 (y mas larga con anticonceptivos orales, mas corta en fumadores). Por
 * eso es configurable.
 *
 * Modulo puro.
 */

export const VIDA_MEDIA_DEFAULT_H = 5.7;
/** mg activos que se consideran compatibles con dormirse bien. */
export const UMBRAL_DORMIR_MG = 50;

export interface Dosis {
  tomadoMs: number;
  mg: number;
}

/** Bebidas de referencia, en mg de cafeina por porcion tipica. */
export const BEBIDAS: { key: string; nombre: string; mg: number }[] = [
  { key: 'espresso', nombre: 'Espresso', mg: 63 },
  { key: 'americano', nombre: 'Americano', mg: 120 },
  { key: 'filtrado', nombre: 'Cafe filtrado (240 ml)', mg: 95 },
  { key: 'capuchino', nombre: 'Capuchino', mg: 75 },
  { key: 'te_negro', nombre: 'Te negro', mg: 47 },
  { key: 'te_verde', nombre: 'Te verde', mg: 28 },
  { key: 'energizante', nombre: 'Energizante (250 ml)', mg: 80 },
  { key: 'cola', nombre: 'Gaseosa cola (350 ml)', mg: 34 },
  { key: 'chocolate', nombre: 'Chocolate negro (50 g)', mg: 25 },
];

/** mg activos en el cuerpo en un instante dado, sumando todas las dosis. */
export function mgActivos(dosis: Dosis[], enMs: number, vidaMediaH = VIDA_MEDIA_DEFAULT_H): number {
  let total = 0;
  for (const d of dosis) {
    if (!Number.isFinite(d.tomadoMs) || !Number.isFinite(d.mg) || d.mg <= 0) continue;
    const horas = (enMs - d.tomadoMs) / 3_600_000;
    if (horas < 0) continue;
    total += d.mg * Math.pow(0.5, horas / vidaMediaH);
  }
  return Math.round(total * 10) / 10;
}

/** Curva de mg activos entre dos instantes, para dibujarla. */
export function curvaCafeina(
  dosis: Dosis[],
  desdeMs: number,
  hastaMs: number,
  vidaMediaH = VIDA_MEDIA_DEFAULT_H,
  pasoMin = 15,
): { ms: number; mg: number }[] {
  const puntos: { ms: number; mg: number }[] = [];
  const paso = pasoMin * 60_000;
  for (let ms = desdeMs; ms <= hastaMs; ms += paso) {
    puntos.push({ ms, mg: mgActivos(dosis, ms, vidaMediaH) });
  }
  return puntos;
}

/**
 * Ultima hora a la que se puede tomar `mg` y llegar a `dormirMs` por debajo del
 * umbral, contando lo que YA hay en el cuerpo. Devuelve null si ni tomando cero
 * se llega limpio (es decir: el corte ya paso).
 */
export function horaCorte(
  dosis: Dosis[],
  dormirMs: number,
  mgProxima: number,
  umbralMg = UMBRAL_DORMIR_MG,
  vidaMediaH = VIDA_MEDIA_DEFAULT_H,
): number | null {
  const yaEnCuerpo = mgActivos(dosis, dormirMs, vidaMediaH);
  const margen = umbralMg - yaEnCuerpo;
  if (margen <= 0) return null;
  if (mgProxima <= margen) return dormirMs; // cabe a cualquier hora
  // mgProxima * 0.5^(h/vidaMedia) = margen  =>  h = vidaMedia * log2(mgProxima/margen)
  const horas = vidaMediaH * Math.log2(mgProxima / margen);
  return dormirMs - horas * 3_600_000;
}

/** Horas que faltan para que los mg activos bajen del umbral. */
export function horasHastaLimpio(
  dosis: Dosis[],
  desdeMs: number,
  umbralMg = UMBRAL_DORMIR_MG,
  vidaMediaH = VIDA_MEDIA_DEFAULT_H,
): number {
  let mg = mgActivos(dosis, desdeMs, vidaMediaH);
  if (mg <= umbralMg) return 0;
  // Busqueda simple hacia adelante: con varias dosis la suma no se invierte en
  // forma cerrada, y 15 min de resolucion sobra para lo que se decide con esto.
  for (let h = 0.25; h <= 24; h += 0.25) {
    mg = mgActivos(dosis, desdeMs + h * 3_600_000, vidaMediaH);
    if (mg <= umbralMg) return Math.round(h * 100) / 100;
  }
  return 24;
}

/** Total de mg del dia, para el limite diario recomendado (400 mg en adultos). */
export const LIMITE_DIARIO_MG = 400;

export function totalDelDia(dosis: Dosis[]): number {
  return dosis.reduce((a, d) => a + (Number.isFinite(d.mg) ? Math.max(0, d.mg) : 0), 0);
}
