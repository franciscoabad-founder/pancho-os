// Lógica pura de ayuno: fases y duración. Compartida entre UI y (potencial) agente.

export interface FaseAyuno {
  key: string;
  nombre: string;
  desde: number; // horas
  hasta: number; // horas (Infinity para la última)
  descripcion: string;
}

export const FASES_AYUNO: FaseAyuno[] = [
  { key: 'digestion',  nombre: 'Digestión',        desde: 0,  hasta: 4,        descripcion: 'El cuerpo procesa la última comida. Insulina alta, usando glucosa.' },
  { key: 'transicion', nombre: 'Transición',       desde: 4,  hasta: 12,       descripcion: 'Baja la insulina. El cuerpo empieza a usar glucógeno del hígado.' },
  { key: 'quema',      nombre: 'Quema de grasa',   desde: 12, hasta: 16,       descripcion: 'Glucógeno casi agotado. Empieza la lipólisis: se moviliza grasa.' },
  { key: 'cetosis',    nombre: 'Cetosis ligera',   desde: 16, hasta: 24,       descripcion: 'Producción de cetonas en aumento. Energía estable, menos hambre.' },
  { key: 'autofagia',  nombre: 'Autofagia',        desde: 24, hasta: Infinity, descripcion: 'Reciclaje celular acelerado. El cuerpo limpia células dañadas.' },
];

/** Devuelve las horas transcurridas entre inicio y fin (o ahora si fin es null). */
export function duracionHoras(inicioISO: string, finISO: string | null, ahoraMs?: number): number {
  const inicio = new Date(inicioISO).getTime();
  const fin = finISO ? new Date(finISO).getTime() : (ahoraMs ?? Date.now());
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin < inicio) return 0;
  return (fin - inicio) / 3_600_000;
}

/** Fase actual del ayuno dado el número de horas transcurridas. */
export function faseActual(horas: number): FaseAyuno {
  const h = Number.isFinite(horas) && horas > 0 ? horas : 0;
  for (const f of FASES_AYUNO) {
    if (h >= f.desde && h < f.hasta) return f;
  }
  return FASES_AYUNO[FASES_AYUNO.length - 1];
}

/** Formatea horas decimales como "16h 32m". */
export function formatearDuracion(horas: number): string {
  const h = Math.max(0, horas);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
}
