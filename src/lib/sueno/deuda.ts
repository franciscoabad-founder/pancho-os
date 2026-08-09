/**
 * Deuda de sueno: el Proceso S visto en horas, que es como se puede hablar de el.
 *
 * Definicion operativa (la misma familia que usa Rise): deuda = suma de los
 * deficits de las ultimas N noches, donde dormir de mas PAGA deuda en vez de
 * acumular credito infinito. La ventana movil de 14 dias hace que una mala
 * racha vieja deje de pesar sola, sin necesidad de "perdonarla" a mano.
 *
 * Modulo puro.
 */

export interface NocheSueno {
  /** Dia al que se acredita el sueno (el de despertar), YYYY-MM-DD. */
  fecha: string;
  /** Minutos dormidos ese dia, incluyendo siestas. */
  minutos: number;
}

export interface DiaDeuda {
  fecha: string;
  horas: number;
  /** horas - necesidad. Negativo = deficit. */
  delta: number;
  /** true si ese dia no tiene ningun registro. */
  sinDato: boolean;
}

export interface ResultadoDeuda {
  /** Deuda acumulada en horas, ya recortada al rango [0, tope]. */
  horas: number;
  /** Deuda como fraccion de la necesidad de una noche (2.0 = dos noches). */
  noches: number;
  tope: number;
  /** true si la deuda toco el tope y el numero real podria ser mayor. */
  topeAlcanzado: boolean;
  dias: DiaDeuda[];
  diasSinDato: number;
  /** Promedio de horas dormidas de los dias CON dato. */
  promedioHoras: number;
  nivel: 'saldada' | 'baja' | 'media' | 'alta';
}

export const VENTANA_DIAS = 14;

/**
 * Tope de la deuda, en multiplos de la necesidad diaria. Sin tope, un mes malo
 * produce numeros que ya no informan nada (y que el cuerpo tampoco arrastra:
 * la recuperacion no es lineal ni total).
 */
export const TOPE_NOCHES = 2.5;

/** Resta dias a una fecha YYYY-MM-DD sin tocar zonas horarias. */
export function restarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula la deuda a la fecha `hasta` mirando hacia atras `ventana` dias.
 * Los dias sin dato cuentan como delta 0 (neutros): inventar un deficit seria
 * castigar por no haber medido, e inventar la necesidad completa seria mentir
 * al reves. Se reportan aparte para que el UI avise que el numero va corto.
 */
export function calcularDeuda(
  noches: NocheSueno[],
  necesidadH: number,
  hasta: string,
  ventana = VENTANA_DIAS,
): ResultadoDeuda {
  const porFecha = new Map<string, number>();
  for (const n of noches) {
    if (!n?.fecha || !Number.isFinite(n.minutos)) continue;
    porFecha.set(n.fecha, (porFecha.get(n.fecha) ?? 0) + Math.max(0, n.minutos));
  }

  const dias: DiaDeuda[] = [];
  for (let i = ventana - 1; i >= 0; i--) {
    const fecha = restarDias(hasta, i);
    const min = porFecha.get(fecha);
    const horas = min === undefined ? 0 : min / 60;
    dias.push({
      fecha,
      horas: Math.round(horas * 100) / 100,
      delta: min === undefined ? 0 : Math.round((horas - necesidadH) * 100) / 100,
      sinDato: min === undefined,
    });
  }

  const tope = Math.round(necesidadH * TOPE_NOCHES * 10) / 10;
  const bruta = -dias.reduce((acc, d) => acc + d.delta, 0);
  const horas = Math.round(Math.min(tope, Math.max(0, bruta)) * 10) / 10;

  const conDato = dias.filter((d) => !d.sinDato);
  const promedioHoras = conDato.length
    ? Math.round((conDato.reduce((a, d) => a + d.horas, 0) / conDato.length) * 100) / 100
    : 0;

  return {
    horas,
    noches: Math.round((horas / necesidadH) * 100) / 100,
    tope,
    topeAlcanzado: bruta > tope,
    dias,
    diasSinDato: dias.filter((d) => d.sinDato).length,
    promedioHoras,
    nivel: nivelDeuda(horas, necesidadH),
  };
}

/**
 * Franjas de lectura. El corte de "saldada" no es cero: un adulto normal vive
 * con una deuda residual pequena y perseguir el cero es una forma de ansiedad,
 * no de salud.
 */
export function nivelDeuda(horas: number, necesidadH: number): ResultadoDeuda['nivel'] {
  const r = horas / necesidadH;
  if (r < 0.25) return 'saldada';
  if (r < 0.65) return 'baja';
  if (r < 1.25) return 'media';
  return 'alta';
}

export const NECESIDAD_MIN_H = 6;
export const NECESIDAD_MAX_H = 10;
export const NECESIDAD_DEFAULT_H = 8;

/**
 * Estima la necesidad individual de sueno desde el historico.
 *
 * Se usa el percentil 90 de las noches registradas, no el promedio: el promedio
 * de alguien con deuda cronica devuelve su deficit como si fuera su necesidad,
 * y el sistema quedaria calibrado para mantenerlo cansado. El percentil alto se
 * acerca a las noches libres, que es cuando el cuerpo toma lo que necesita.
 *
 * Con menos de `minNoches` registros no estima nada: devuelve null y el llamador
 * usa la configuracion manual.
 */
export function necesidadEstimada(noches: NocheSueno[], minNoches = 14): number | null {
  const horas = noches
    .map((n) => n.minutos / 60)
    .filter((h) => Number.isFinite(h) && h >= 2 && h <= 14)
    .sort((a, b) => a - b);
  if (horas.length < minNoches) return null;
  const idx = Math.min(horas.length - 1, Math.floor(horas.length * 0.9));
  const p90 = horas[idx];
  const acotada = Math.min(NECESIDAD_MAX_H, Math.max(NECESIDAD_MIN_H, p90));
  return Math.round(acotada * 4) / 4; // a cuartos de hora
}

/** "7 h 20 min" a partir de horas decimales. */
export function formatearHoras(horas: number): string {
  const signo = horas < 0 ? '-' : '';
  const abs = Math.abs(horas);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  if (m === 60) return `${signo}${h + 1} h`;
  if (h === 0) return `${signo}${m} min`;
  if (m === 0) return `${signo}${h} h`;
  return `${signo}${h} h ${m} min`;
}
