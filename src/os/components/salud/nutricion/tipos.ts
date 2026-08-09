// Nutricion OS — tipos + constantes + helpers puros compartidos por todos los
// sub-componentes. Contrato exacto de /api/os/salud/{comidas-log,alimentos,config,
// recetas,meals}.ts (ver lectura de esos archivos antes de tocar esto).

export interface Porcion {
  id: string;
  alimento_id?: string;
  nombre: string;
  gramos: number;
  orden?: number | null;
}

export interface Alimento {
  id: string;
  nombre: string;
  marca: string | null;
  fuente: string;
  barcode?: string | null;
  kcal: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  fibra_g: number | null;
  azucares_g?: number | null;
  saturada_g?: number | null;
  monoinsaturada_g?: number | null;
  poliinsaturada_g?: number | null;
  sodio_mg?: number | null;
  colesterol_mg?: number | null;
  favorito?: boolean;
  veces_usado?: number;
  ultima_vez?: string | null;
  alimento_porciones: Porcion[];
}

export interface Comida {
  id: string;
  fecha: string;
  momento: string;
  alimento_id: string | null;
  descripcion_libre: string | null;
  cantidad_g: number | null;
  kcal: number | null;
  proteina_g: number | null;
  carbos_g: number | null;
  grasa_g: number | null;
  fibra_g: number | null;
  azucares_g?: number | null;
  saturada_g?: number | null;
  monoinsaturada_g?: number | null;
  poliinsaturada_g?: number | null;
  sodio_mg?: number | null;
  colesterol_mg?: number | null;
  foto_url?: string | null;
  source: string;
  tipo_dia: string;
  notas: string | null;
}

export interface Totales {
  kcal: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  fibra_g?: number;
}

export interface Targets {
  kcal: number | null;
  proteina_g: number | null;
  carbos_g: number | null;
  grasa_g: number | null;
}

export interface RecetaIngrediente {
  id: string;
  receta_id: string;
  orden: number | null;
  descripcion: string;
  alimento_id: string | null;
  cantidad_g: number | null;
}

export interface Receta {
  id: string;
  nombre: string;
  descripcion: string | null;
  porciones: number | null;
  tiempo_min: number | null;
  instrucciones: string[];
  foto_url: string | null;
  fuente: string | null;
  fuente_url: string | null;
  kcal: number | null;
  proteina_g: number | null;
  carbos_g: number | null;
  grasa_g: number | null;
  tags: string[] | null;
  ingredientes?: RecetaIngrediente[];
}

export interface MealItem {
  alimento_id?: string | null;
  descripcion: string;
  cantidad_g?: number | null;
  kcal?: number | null;
  proteina_g?: number | null;
  carbos_g?: number | null;
  grasa_g?: number | null;
}

export interface Meal {
  id: string;
  nombre: string;
  items: MealItem[];
  kcal: number | null;
  proteina_g: number | null;
  carbos_g: number | null;
  grasa_g: number | null;
  veces_usado: number;
}

export interface ConfigSalud {
  id: string;
  kcal_objetivo: number | null;
  proteina_objetivo_g: number | null;
  carbos_objetivo_g: number | null;
  grasa_objetivo_g: number | null;
}

export type Momento = 'desayuno' | 'almuerzo' | 'cena' | 'snack';
export const MOMENTOS: Momento[] = ['desayuno', 'almuerzo', 'cena', 'snack'];
export const MOMENTO_LABEL: Record<Momento, string> = {
  desayuno: 'Desayuno', almuerzo: 'Almuerzo', cena: 'Cena', snack: 'Snacks',
};
export const MOMENTO_ICON: Record<Momento, string> = {
  desayuno: 'free_breakfast', almuerzo: 'lunch_dining', cena: 'dinner_dining', snack: 'cookie',
};

export const TIPOS_DIA = [
  { key: 'normal', label: 'Normal' },
  { key: 'leg_day', label: 'Leg day' },
  { key: 'refeed', label: 'Refeed' },
  { key: 'keto_light', label: 'Keto light' },
  { key: 'keto', label: 'Keto' },
];

export const MODOS_BUSQUEDA = [
  { key: 'recientes', label: 'Recientes' },
  { key: 'frecuentes', label: 'Frecuentes' },
  { key: 'favoritos', label: 'Favoritas' },
] as const;

export type ModoBusqueda = typeof MODOS_BUSQUEDA[number]['key'];

export type TabAgregar = 'buscar' | 'recetas' | 'meals' | 'foto' | 'mas';

// ── Fecha (zona Guayaquil, consistente con el backend) ─────────────────────
const TZ = 'America/Guayaquil';
export function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}
export function addDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}
export function fechaLarga(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-EC', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// ── Numeros ──────────────────────────────────────────────────────────────
export const round = (n: number): number => Math.round(n * 10) / 10;

/** Gramos efectivos a partir de una porcion (o gramos directos si porcionId es null). */
export function gramosEfectivos(cantidad: number, porcion: Porcion | null): number {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 0;
  if (porcion) return round(porcion.gramos * cantidad);
  return round(cantidad);
}

/** Macros previstos de un alimento (por 100 g) escalados a los gramos efectivos. */
export function previewMacros(alimento: Alimento, gramos: number) {
  const f = gramos / 100;
  return {
    kcal: round(alimento.kcal * f),
    proteina_g: round(alimento.proteina_g * f),
    carbos_g: round(alimento.carbos_g * f),
    grasa_g: round(alimento.grasa_g * f),
  };
}

/**
 * Color de estado para anillos y numeros de macro: champagne cuando el consumo
 * esta entre 90-105% del target, coral suave solo por encima de 115%, accent en
 * el resto (incluye "todavia falta"). Sin target valido => color neutro (linea).
 */
export function colorMacro(consumido: number, target: number | null): string {
  if (target == null || target <= 0) return 'var(--os-line-accent)';
  const ratio = consumido / target;
  if (ratio > 1.15) return '#E8709A';
  if (ratio >= 0.9 && ratio <= 1.05) return 'var(--os-champagne)';
  return 'var(--os-accent)';
}

/** Porcentaje de relleno del anillo (0-100), acotado para no desbordar el circulo. */
export function pctAnillo(consumido: number, target: number | null): number {
  if (target == null || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((consumido / target) * 100)));
}

/** Suma sin nulos de una columna de un conjunto de comidas; null si no hay ningun dato. */
export function sumarColumna(comidas: Comida[], col: keyof Comida): number | null {
  let total = 0;
  let tieneDato = false;
  for (const c of comidas) {
    const v = c[col];
    if (v == null) continue;
    tieneDato = true;
    total += Number(v) || 0;
  }
  return tieneDato ? round(total) : null;
}

export const COLUMNAS_DESGLOSE: { col: keyof Comida; label: string; unidad: string }[] = [
  { col: 'kcal', label: 'Calorias', unidad: 'kcal' },
  { col: 'proteina_g', label: 'Proteina', unidad: 'g' },
  { col: 'carbos_g', label: 'Carbohidratos', unidad: 'g' },
  { col: 'grasa_g', label: 'Grasa', unidad: 'g' },
  { col: 'fibra_g', label: 'Fibra', unidad: 'g' },
  { col: 'azucares_g', label: 'Azucares', unidad: 'g' },
  { col: 'saturada_g', label: 'Grasa saturada', unidad: 'g' },
  { col: 'monoinsaturada_g', label: 'Grasa monoinsaturada', unidad: 'g' },
  { col: 'poliinsaturada_g', label: 'Grasa poliinsaturada', unidad: 'g' },
  { col: 'sodio_mg', label: 'Sodio', unidad: 'mg' },
  { col: 'colesterol_mg', label: 'Colesterol', unidad: 'mg' },
];
