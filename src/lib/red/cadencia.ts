// A quien toca esta semana: comparar ultima_interaccion + frecuencia_dias
// contra hoy. Sin interaccion previa se considera vencida de inmediato (nunca
// contactada = maxima prioridad, no la mas baja).

export interface PersonaCadencia {
  id: string;
  nombre: string;
  ultima_interaccion: string | null; // 'YYYY-MM-DD'
  frecuencia_dias: number;
}

function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00Z`).getTime();
  const b = new Date(`${hasta}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86_400_000);
}

/** Personas cuya ventana de contacto ya vencio, ordenadas por cuanto tiempo
 *  llevan vencidas (peor primero). `hoy` inyectable para tests puros. */
export function vencidos<T extends PersonaCadencia>(personas: T[], hoy: string): T[] {
  return personas
    .filter((p) => p.frecuencia_dias > 0)
    .map((p) => {
      const dias = p.ultima_interaccion ? diasEntre(p.ultima_interaccion, hoy) : Infinity;
      return { p, atraso: dias - p.frecuencia_dias };
    })
    .filter(({ atraso }) => atraso >= 0)
    .sort((a, b) => b.atraso - a.atraso)
    .map(({ p }) => p);
}
