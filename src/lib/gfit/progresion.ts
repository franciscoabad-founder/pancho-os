// Sugerencia de progresión doble (double progression) para el módulo GFIT:
// primero se sube el rango de reps hasta el tope del objetivo, y solo cuando
// TODAS las series de trabajo llegan al tope en 2 sesiones seguidas se sube carga.

export type ObjetivoRutina = 'fuerza' | 'hipertrofia' | 'resistencia';

export interface RangoReps {
  min: number;
  max: number;
}

export interface SerieReciente {
  fecha: string;       // YYYY-MM-DD, agrupa por sesión
  reps: number | null;
  tipo: string;         // warmup | working | drop | failure
}

export interface OpcionesProgresion {
  /** Patrón de movimiento del ejercicio (squat/hinge = compuesto de tren inferior => +5%). */
  patron?: string | null;
}

export interface ProgresionSugerida {
  accion: 'subir_carga' | 'subir_reps' | 'mantener';
  /** % de incremento de carga sugerido cuando accion === 'subir_carga' (0 en los demás casos). */
  incrementoPct: number;
}

/** Rango de reps objetivo según el objetivo de la rutina. Hipertrofia es el default. */
export function rangoReps(objetivo: ObjetivoRutina): RangoReps {
  switch (objetivo) {
    case 'fuerza':
      return { min: 1, max: 5 };
    case 'resistencia':
      return { min: 15, max: 25 };
    case 'hipertrofia':
    default:
      return { min: 6, max: 12 };
  }
}

/** Agrupa series por fecha (sesión), devolviendo las fechas ordenadas desc con sus series. */
function porSesion(series: SerieReciente[]): Array<{ fecha: string; series: SerieReciente[] }> {
  const mapa = new Map<string, SerieReciente[]>();
  for (const s of series) {
    if (!mapa.has(s.fecha)) mapa.set(s.fecha, []);
    mapa.get(s.fecha)!.push(s);
  }
  return Array.from(mapa.entries())
    .map(([fecha, arr]) => ({ fecha, series: arr }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

/** Incremento % sugerido: patrones de tren inferior/bisagra suben más agresivo. */
function incrementoPorPatron(patron: string | null | undefined): number {
  return patron === 'squat' || patron === 'hinge' ? 5 : 2.5;
}

/**
 * Sugerencia de progresión doble para un ejercicio:
 * - Sin series de trabajo => mantener (sin historial suficiente).
 * - Todas las series de trabajo llegan al tope del rango en las últimas 2
 *   sesiones => subir_carga (incrementoPct 2.5 accesorio/pequeño, 5 compuesto).
 * - En cualquier otro caso (aún no se topó, o solo topó 1 sesión) => subir_reps:
 *   seguir empujando reps dentro del rango antes de subir peso.
 */
export function sugerirProgresion(
  seriesRecientes: SerieReciente[],
  objetivo: ObjetivoRutina,
  opciones: OpcionesProgresion = {},
): ProgresionSugerida {
  const rango = rangoReps(objetivo);
  const working = (seriesRecientes ?? []).filter((s) => s.tipo === 'working' && s.reps != null);
  if (!working.length) {
    return { accion: 'mantener', incrementoPct: 0 };
  }

  const sesiones = porSesion(working);
  const topeEn = (arr: SerieReciente[]) =>
    arr.length > 0 && arr.every((s) => (Number(s.reps) || 0) >= rango.max);

  if (sesiones.length >= 2 && topeEn(sesiones[0].series) && topeEn(sesiones[1].series)) {
    return { accion: 'subir_carga', incrementoPct: incrementoPorPatron(opciones.patron) };
  }

  return { accion: 'subir_reps', incrementoPct: 0 };
}
