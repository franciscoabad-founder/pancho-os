// Utilidades de fechas del módulo Hábitos. Todo en America/Guayaquil (UTC-5 fijo, sin DST).
// Lógica pura, testeable con node:test. Consistente con lib/salud/apiHelpers.hoyGuayaquil
// (misma zona horaria y mismo método), implementada aquí sin depender de tipos de Astro.

const TZ = 'America/Guayaquil';

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de Pancho. */
export function hoyLocal(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Día ISO de la semana para una fecha YYYY-MM-DD (1=lunes ... 7=domingo).
 * Usa mediodía (T12:00:00) para evitar que el parseo UTC empuje la fecha al día anterior.
 */
export function diaIso(fecha: string): number {
  const dia = new Date(`${fecha}T12:00:00`).getDay();
  return dia === 0 ? 7 : dia;
}

/** Suma (o resta, si n es negativo) n días a una fecha YYYY-MM-DD. */
export function addDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

/**
 * Próxima ocurrencia programada (día de la semana + hora) desde `desde`, en la zona
 * horaria de Guayaquil. `hora` en formato 'HH:MM'. Si `desde` cae en un día programado
 * y la hora aún no pasó, devuelve ese mismo día a esa hora; si no, avanza al próximo
 * día programado (busca hasta 8 días, cubre cualquier combinación de días de semana).
 */
export function proximaOcurrencia(diasSemana: number[], hora: string, desde: Date): Date {
  const [hh, mm] = hora.split(':').map((x) => parseInt(x, 10));
  const fechaDesde = desde.toLocaleDateString('en-CA', { timeZone: TZ });
  const horaDesde = desde.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hhDesde, mmDesde] = horaDesde.split(':').map((x) => parseInt(x, 10));

  for (let i = 0; i < 8; i++) {
    const fecha = addDias(fechaDesde, i);
    if (!diasSemana.includes(diaIso(fecha))) continue;
    if (i === 0) {
      const yaPaso = hhDesde > hh || (hhDesde === hh && mmDesde >= mm);
      if (yaPaso) continue;
    }
    // Guayaquil es UTC-5 fijo (sin horario de verano): el offset literal es seguro.
    return new Date(`${fecha}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-05:00`);
  }
  // No debería alcanzarse con un diasSemana válido (algún valor entre 1 y 7).
  return desde;
}

/**
 * Construye el timestamp de una fecha (YYYY-MM-DD) a una hora (HH:MM) en la zona
 * horaria de Guayaquil (UTC-5 fijo, sin DST), SIN buscar el próximo día programado
 * como hace proximaOcurrencia. Útil para agendar el recordatorio one-shot de HOY
 * (el cierre diario ya sabe que hoy es un día programado antes de llamar a esto).
 */
export function timestampGuayaquil(fecha: string, hora: string): Date {
  const [hh, mm] = hora.split(':').map((x) => parseInt(x, 10));
  return new Date(`${fecha}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-05:00`);
}
