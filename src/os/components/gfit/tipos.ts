// GFIT — tipos + constantes + helpers compartidos por todos los sub-componentes.
// Contrato exacto de los endpoints /api/os/gfit/*.ts (ver notas del módulo).

export type TipoDia = 'weekday' | 'orden' | 'descanso';
export type TipoSerie = 'warmup' | 'working' | 'drop' | 'failure';
export type UnidadPeso = 'kg' | 'lb';
export type Objetivo = 'fuerza' | 'hipertrofia' | 'resistencia';
export type Nivel = 'beginner' | 'intermediate' | 'expert';

export interface MusculoPrimario {
  grupo: string;
  sub?: string | null;
}

export interface Ejercicio {
  id: string;
  slug: string;
  nombre_en: string | null;
  nombre_es: string | null;
  imagenes: string[] | null;
  equipo: string[] | null;
  patron: string | null;
  musculos_primarios: MusculoPrimario[] | null;
  nivel?: Nivel | null;
  instrucciones_en?: string[] | null;
}

export interface SeriePlan {
  id: string;
  orden: number;
  tipo: TipoSerie;
  peso_kg: number | null;
  reps: number | null;
  descanso_s: number | null;
}

export interface DiaEjercicio {
  id: string;
  dia_id?: string;
  ejercicio_id: string;
  orden: number;
  superset_grupo: number | null;
  notas: string | null;
  ejercicio: Ejercicio;
  gfit_series_plan: SeriePlan[];
}

export interface Dia {
  id: string;
  rutina_id?: string;
  nombre: string;
  tipo: TipoDia;
  weekday: number | null;
  orden: number | null;
  gfit_dia_ejercicios: DiaEjercicio[];
}

export interface Rutina {
  id: string;
  nombre: string;
  descripcion: string | null;
  objetivo: Objetivo | null;
  estado: 'activa' | 'archivada';
  dias?: { count: number }[];
}

export const OBJETIVOS: { key: Objetivo; label: string }[] = [
  { key: 'fuerza', label: 'Fuerza' },
  { key: 'hipertrofia', label: 'Hipertrofia' },
  { key: 'resistencia', label: 'Resistencia' },
];

export const NIVELES: { key: Nivel; label: string }[] = [
  { key: 'beginner', label: 'Principiante' },
  { key: 'intermediate', label: 'Intermedio' },
  { key: 'expert', label: 'Avanzado' },
];

export const WEEKDAY_LABEL: Record<number, string> = {
  1: 'LUN', 2: 'MAR', 3: 'MIÉ', 4: 'JUE', 5: 'VIE', 6: 'SÁB', 7: 'DOM',
};
export const WEEKDAY_CORTO: Record<number, string> = {
  1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D',
};

export const TIPOS_SERIE_ORDEN: TipoSerie[] = ['warmup', 'working', 'drop', 'failure'];
// Colores categóricos de tipo de serie (paridad Jefit). warmup y failure no
// tienen token --os-* equivalente: ámbar y coral del canon, nunca verde.
export const TIPO_SERIE_COLOR: Record<TipoSerie, string> = {
  warmup: '#EF9F27',
  working: 'var(--os-accent)',
  drop: 'var(--os-accent-light)',
  failure: '#E8709A',
};
export const TIPO_SERIE_DEF: Record<TipoSerie, { titulo: string; texto: string }> = {
  warmup: { titulo: 'Calentamiento (W)', texto: 'Prepara la articulación y el patrón de movimiento. No cuenta al volumen de entrenamiento.' },
  working: { titulo: 'Working (1, 2, 3...)', texto: 'El núcleo del entrenamiento: el peso y las reps que realmente construyen el estímulo.' },
  drop: { titulo: 'Dropset (D)', texto: 'Al llegar al límite, se reduce el peso y se sigue de inmediato sin descanso.' },
  failure: { titulo: 'Al fallo (F)', texto: 'Se ejecuta hasta el fallo técnico: ya no se puede completar una repetición más con buena forma.' },
};

export const GRUPO_ES: Record<string, string> = {
  abs: 'Abdomen', back: 'Espalda', biceps: 'Bíceps', chest: 'Pecho', forearms: 'Antebrazos',
  glutes: 'Glúteos', shoulders: 'Hombros', triceps: 'Tríceps', 'upper-leg': 'Pierna superior',
  'lower-leg': 'Pierna inferior', cardio: 'Cardio',
};

/** Nombre a mostrar (ES si existe, si no EN). */
export function nombreEjercicio(e: Pick<Ejercicio, 'nombre_es' | 'nombre_en'> | null | undefined): string {
  return e?.nombre_es ?? e?.nombre_en ?? 'Ejercicio';
}

/** Chips de grupo muscular (ES) únicos a partir de musculos_primarios. */
export function chipsGrupo(e: Ejercicio | null | undefined): string[] {
  const grupos = (e?.musculos_primarios ?? []).map((m) => GRUPO_ES[m.grupo] ?? m.grupo);
  return Array.from(new Set(grupos));
}

/** Badge de día: LUN/MAR (weekday), "Día N" (orden) o "Descanso". */
export function badgeDia(dia: Pick<Dia, 'tipo' | 'weekday' | 'orden'>): { texto: string; tono: 'accent' | 'muted' } {
  if (dia.tipo === 'weekday' && dia.weekday) return { texto: WEEKDAY_LABEL[dia.weekday] ?? '?', tono: 'accent' };
  if (dia.tipo === 'descanso') return { texto: 'Descanso', tono: 'muted' };
  return { texto: `Día ${dia.orden != null ? dia.orden + 1 : ''}`.trim(), tono: 'accent' };
}

/** Estimado de duración del día: 40s por serie + suma de descansos planificados. */
export function estimarMinutos(dia: Pick<Dia, 'gfit_dia_ejercicios'>): number {
  let segundos = 0;
  for (const de of dia.gfit_dia_ejercicios ?? []) {
    for (const s of de.gfit_series_plan ?? []) {
      segundos += 40 + (s.descanso_s ?? 0);
    }
  }
  return Math.max(1, Math.round(segundos / 60));
}

/** Resumen "4 series · 8-12 reps" para la card de ejercicio. */
export function resumenSeries(series: SeriePlan[]): string {
  const n = series.length;
  if (!n) return 'Sin series';
  const reps = series.map((s) => s.reps).filter((r): r is number => r != null);
  if (!reps.length) return `${n} serie${n === 1 ? '' : 's'}`;
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  const rangoTxt = min === max ? `${min}` : `${min}-${max}`;
  return `${n} serie${n === 1 ? '' : 's'} · ${rangoTxt} reps`;
}

/** Etiqueta de badge de tipo de serie: W / 1,2,3... / D / F, según posición entre sets del mismo tipo. */
export function etiquetasSeries(series: SeriePlan[]): string[] {
  let contadorWorking = 0;
  return series.map((s) => {
    if (s.tipo === 'warmup') return 'W';
    if (s.tipo === 'drop') return 'D';
    if (s.tipo === 'failure') return 'F';
    contadorWorking += 1;
    return String(contadorWorking);
  });
}

export function siguienteTipoSerie(actual: TipoSerie): TipoSerie {
  const i = TIPOS_SERIE_ORDEN.indexOf(actual);
  return TIPOS_SERIE_ORDEN[(i + 1) % TIPOS_SERIE_ORDEN.length];
}
