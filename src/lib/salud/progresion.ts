// Motor de progresión y analytics de Salud OS. Lógica pura, testeable con node:test.

// ── Tipos de entrada ─────────────────────────────────────────────────────────
export interface SetHist {
  fecha: string;        // YYYY-MM-DD (agrupa por sesión)
  reps: number | null;
  peso_kg: number | null;
  tipo_set: string;     // working | warmup | ...
  completado?: boolean;
}

export interface EjercicioMeta {
  repsMin: number;
  repsMax: number;
  patron: string | null; // push_h | push_v | pull_h | pull_v | squat | hinge | core | otro
}

export interface SugerenciaOverload {
  accion: 'subir' | 'bajar' | 'mantener';
  deltaKg: number;
  pesoSugerido: number | null;
  razon: string;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Incremento de carga sugerido según patrón: tren inferior/bisagra +5kg, resto +2.5kg. */
export function incrementoPorPatron(patron: string | null): number {
  return patron === 'squat' || patron === 'hinge' ? 5 : 2.5;
}

/** Agrupa sets por fecha (sesión), devolviendo las fechas ordenadas desc con sus sets. */
function porSesion(sets: SetHist[]): Array<{ fecha: string; sets: SetHist[] }> {
  const mapa: Map<string, SetHist[]> = new Map();
  for (const s of sets) {
    if (!mapa.has(s.fecha)) mapa.set(s.fecha, []);
    mapa.get(s.fecha)!.push(s);
  }
  return Array.from(mapa.entries())
    .map(([fecha, arr]) => ({ fecha, sets: arr }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

/**
 * (a) Sugerencia de progressive overload para un ejercicio.
 * - Si en las últimas 2 sesiones se alcanzó el tope del rango de reps en TODOS los
 *   working sets → subir (+2.5kg upper / +5kg lower/compuesto).
 * - Si se falló el mínimo de reps en >=2 working sets recientes → bajar 10%.
 * - Si no hay suficiente historial o el patrón es mixto → mantener.
 */
export function sugerenciaOverload(sets: SetHist[], meta: EjercicioMeta): SugerenciaOverload {
  const working = (sets ?? []).filter((s) => s.tipo_set === 'working' && s.reps != null);
  if (!working.length) {
    return { accion: 'mantener', deltaKg: 0, pesoSugerido: null, razon: 'Sin historial suficiente.' };
  }
  const sesiones = porSesion(working);

  // Peso de referencia: el más frecuente/último de la sesión más reciente.
  const ultimaSesion = sesiones[0].sets;
  const pesoRef = ultimaSesion.reduce((max, s) => Math.max(max, Number(s.peso_kg) || 0), 0);

  // Falla del mínimo: contar working sets recientes (últimas 3 sesiones) por debajo de repsMin.
  const recientes = sesiones.slice(0, 3).flatMap((s) => s.sets);
  const fallos = recientes.filter((s) => (Number(s.reps) || 0) < meta.repsMin).length;
  if (fallos >= 2) {
    const delta = -round(pesoRef * 0.1);
    return {
      accion: 'bajar', deltaKg: delta,
      pesoSugerido: pesoRef > 0 ? round(pesoRef + delta) : null,
      razon: `Fallaste el mínimo de ${meta.repsMin} reps en ${fallos} sets. Baja ~10%.`,
    };
  }

  // Subir: últimas 2 sesiones con TODOS los working sets en el tope del rango.
  if (sesiones.length >= 2) {
    const topeEn = (s: { sets: SetHist[] }) =>
      s.sets.length > 0 && s.sets.every((x) => (Number(x.reps) || 0) >= meta.repsMax);
    if (topeEn(sesiones[0]) && topeEn(sesiones[1])) {
      const delta = incrementoPorPatron(meta.patron);
      return {
        accion: 'subir', deltaKg: delta,
        pesoSugerido: pesoRef > 0 ? round(pesoRef + delta) : null,
        razon: `Llegaste al tope (${meta.repsMax} reps) 2 sesiones seguidas. Sube ${delta} kg.`,
      };
    }
  }

  return { accion: 'mantener', deltaKg: 0, pesoSugerido: pesoRef > 0 ? pesoRef : null, razon: 'Mantén la carga y busca el tope del rango.' };
}

// ── (b) Progress Index ───────────────────────────────────────────────────────
export interface SetAnalytics {
  ejercicio_id: string;
  ejercicio_nombre: string;
  grupo: string | null;
  patron: string | null;
  reps: number | null;
  peso_kg: number | null;
  tipo_set: string;
}

export interface ProgressIndex {
  volumenPorGrupo: Record<string, number>;
  e1rmPorEjercicio: Record<string, { nombre: string; e1rm: number }>;
  ratios: { pushPull: number | null; squatHinge: number | null };
  alertas: string[];
}

/** e1RM estimado con la fórmula de Epley: peso × (1 + reps/30). reps<=0 => peso. */
export function e1rmEpley(peso: number, reps: number): number {
  const p = Number(peso) || 0;
  const r = Number(reps) || 0;
  if (p <= 0) return 0;
  if (r <= 1) return round(p);
  return round(p * (1 + r / 30));
}

const PUSH = new Set(['push_h', 'push_v']);
const PULL = new Set(['pull_h', 'pull_v']);

/**
 * (b) Progress Index semanal: volumen por grupo, e1RM por ejercicio (mejor set),
 * ratios push/pull y squat/hinge con alerta si un ratio pasa de 1.5 (en cualquier dirección).
 */
export function progressIndex(sets: SetAnalytics[]): ProgressIndex {
  const volumenPorGrupo: Record<string, number> = {};
  const e1rmPorEjercicio: Record<string, { nombre: string; e1rm: number }> = {};
  let volPush = 0, volPull = 0, volSquat = 0, volHinge = 0;

  for (const s of sets ?? []) {
    if (s.tipo_set === 'warmup') continue;
    const reps = Number(s.reps) || 0;
    const peso = Number(s.peso_kg) || 0;
    const vol = reps * peso;

    const grupo = s.grupo || 'Sin grupo';
    volumenPorGrupo[grupo] = round((volumenPorGrupo[grupo] || 0) + vol);

    const e1rm = e1rmEpley(peso, reps);
    const prev = e1rmPorEjercicio[s.ejercicio_id];
    if (!prev || e1rm > prev.e1rm) {
      e1rmPorEjercicio[s.ejercicio_id] = { nombre: s.ejercicio_nombre, e1rm };
    }

    if (PUSH.has(s.patron || '')) volPush += vol;
    else if (PULL.has(s.patron || '')) volPull += vol;
    else if (s.patron === 'squat') volSquat += vol;
    else if (s.patron === 'hinge') volHinge += vol;
  }

  const ratio = (a: number, b: number): number | null => {
    if (a <= 0 && b <= 0) return null;
    if (b <= 0) return Infinity;
    return round(a / b);
  };
  const pushPull = ratio(volPush, volPull);
  const squatHinge = ratio(volSquat, volHinge);

  const alertas: string[] = [];
  const desbalance = (r: number | null, etiqueta: string) => {
    if (r == null) return;
    if (r === Infinity) alertas.push(`${etiqueta}: solo entrenas un lado del patrón.`);
    else if (r > 1.5) alertas.push(`${etiqueta}: ratio ${r} muy alto (>1.5), equilibra el lado débil.`);
    else if (r < 1 / 1.5) alertas.push(`${etiqueta}: ratio ${r} muy bajo (<0.67), refuerza el otro lado.`);
  };
  desbalance(pushPull, 'Push/Pull');
  desbalance(squatHinge, 'Squat/Hinge');

  return { volumenPorGrupo, e1rmPorEjercicio, ratios: { pushPull, squatHinge }, alertas };
}

// ── (c) Regla de recuperación ────────────────────────────────────────────────
export interface AjusteRecuperacion {
  ajustePct: number;   // 0 = sin ajuste; -20 = reducir 20% el volumen
  aviso: string | null;
}

/**
 * (c) Ajuste de intensidad según horas de sueño.
 * <5h: -20% volumen sugerido + aviso. 5-6h: -10% suave. >=6h o null: sin ajuste.
 */
export function ajusteRecuperacion(horasSueno: number | null | undefined): AjusteRecuperacion {
  if (horasSueno == null || !Number.isFinite(horasSueno)) {
    return { ajustePct: 0, aviso: null };
  }
  if (horasSueno < 5) {
    return { ajustePct: -20, aviso: `Dormiste ${round(horasSueno)}h (<5h). Baja el volumen ~20% y prioriza técnica.` };
  }
  if (horasSueno < 6) {
    return { ajustePct: -10, aviso: `Dormiste ${round(horasSueno)}h. Considera bajar el volumen ~10%.` };
  }
  return { ajustePct: 0, aviso: null };
}

/** Promedio móvil de N puntos sobre una serie [{x, y}]. Usado por las gráficas. */
export function promedioMovil(serie: Array<{ x: string; y: number }>, ventana: number): Array<{ x: string; y: number }> {
  const n = Math.max(1, ventana);
  return serie.map((punto, i) => {
    const desde = Math.max(0, i - n + 1);
    const trozo = serie.slice(desde, i + 1);
    const avg = trozo.reduce((a, b) => a + b.y, 0) / trozo.length;
    return { x: punto.x, y: round(avg) };
  });
}
