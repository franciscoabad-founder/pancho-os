/**
 * Resolucion del peso corporal cuando hay dos tablas que lo guardan.
 *
 * ── EL PROBLEMA ────────────────────────────────────────────────────────────
 * El peso corporal vive en DOS tablas que nunca se cruzaron:
 *
 *   cuerpo_log      (escribe /api/salud/cuerpo)
 *     - Log append-only del modulo Salud. Una fila por medicion, varias filas
 *       por dia posibles (no hay unique por fecha).
 *     - Columnas: peso_kg, grasa_pct, musculo_kg, agua_pct, cintura_cm,
 *       sueno_horas, source, notas.
 *     - source es una lista cerrada: 'manual' | 'renpho' | 'fitbit'.
 *       OJO: no es "solo manual". El POST acepta X-OS-Token justamente para
 *       que la balanza Renpho / Fitbit escriban aqui via n8n. Lo que define a
 *       esta tabla no es "lo escribio un humano" sino que es el log de
 *       composicion corporal del modulo Salud: la medicion intencional, con
 *       grasa/musculo/cintura al lado, la que Pancho revisa y edita a mano
 *       (tiene PATCH y DELETE por id).
 *     - Dispara evento de juego (registrarEvento 'registro_cuerpo').
 *
 *   biometricas_dia (escribe /api/biometricas)
 *     - Espejo diario agregado de fuentes externas. Upsert idempotente por
 *       fecha (onConflict: 'fecha'), asi que hay como maximo una fila por dia.
 *     - Columnas: pasos, sueno_min, peso_kg, fc_reposo, fuente, raw.
 *     - fuente es texto libre, default 'google_health'. Lo alimenta un flujo
 *       n8n (contrato en docs/contrato-biometricas.md).
 *     - El upsert MERGEA solo las metricas presentes, o sea que el peso llega
 *       como un campo mas del volcado diario, no como una medicion deliberada.
 *
 * Resultado: dos verdades para "cuanto peso hoy" sin ninguna regla que las
 * cruce. La UI de Cuerpo lee cuerpo_log, el resto del sistema que consuma
 * biometricas_dia ve otro numero, y nadie sabe cual manda.
 *
 * ── LA DECISION (conservadora, reversible) ─────────────────────────────────
 * NO se fusionan las tablas y NO se toca el modelo de escritura de ninguna.
 * Ambos endpoints siguen aceptando peso_kg exactamente como hoy. Lo unico que
 * se agrega es esta capa de LECTURA que decide cual mostrar:
 *
 *   1. Si hay peso en cuerpo_log para esa fecha -> gana cuerpo_log.
 *   2. Si no, cae a biometricas_dia.
 *   3. Si tampoco -> null (no se inventa un peso).
 *
 * Por que cuerpo_log manda: es la medicion intencional del modulo Salud, la
 * que trae composicion corporal al lado, la que Pancho puede corregir y la que
 * ya alimenta progreso/onboarding. biometricas_dia es un espejo de terceros
 * que rellena los dias sin medicion propia.
 *
 * Es exactamente el mismo criterio que ya se aplica al SUEnO en
 * src/lib/sueno/estado.ts ("la sesion manda; biometricas_dia rellena los dias
 * sin sesion"). Con esto el peso deja de ser la excepcion.
 *
 * Por que NO fusionar (que es lo que uno haria por prolijidad):
 *   - Fusionar implica migracion de datos y elegir que se pierde cuando las
 *     dos tablas discrepan en un mismo dia. Irreversible.
 *   - cuerpo_log es append-only con varias filas por dia; biometricas_dia es
 *     una fila por dia. Los modelos no son compatibles sin decidir cual gana,
 *     que es justo la decision que esta capa toma sin borrar nada.
 *   - Hay escritores externos vivos (n8n, balanza) apuntando a cada endpoint.
 *     Cambiar el modelo de escritura los rompe en silencio.
 *
 * Como revertir: borrar este archivo y sus llamadas. Cero impacto en datos,
 * porque este modulo nunca escribe. Como cambiar la preferencia: invertir el
 * orden en pesoDelDia(). Nada mas.
 *
 * ── ESTADO DEL PORT (rama tanstack-migration) ──────────────────────────────
 * /api/salud/cuerpo y /api/biometricas TODAVIA NO estan portados a TanStack:
 * siguen en src/pages/api/ (Astro), y astro ya no es dependencia del proyecto,
 * asi que ese arbol hoy no corre. Por eso la regla vive aqui, en un modulo
 * puro y testeado, y no en un endpoint nuevo que naceria muerto.
 * Al portar esas rutas a src/routes/api/, exponer esto en la lectura. Receta
 * en el comentario al pie de este archivo.
 *
 * Modulo puro: recibe filas, devuelve el resuelto. Sin Supabase, sin fetch.
 */

/** De que tabla salio el peso que se esta mostrando. */
export type OrigenPeso = 'cuerpo_log' | 'biometricas_dia';

/** Fila de cuerpo_log, solo lo que hace falta para resolver el peso. */
export interface FilaPesoCuerpo {
  fecha: string;
  peso_kg: number | string | null;
  /** 'manual' | 'renpho' | 'fitbit'. */
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Fila de biometricas_dia, solo lo que hace falta para resolver el peso. */
export interface FilaPesoBiometrica {
  fecha: string;
  peso_kg: number | string | null;
  /** Texto libre, tipico 'google_health'. */
  fuente?: string | null;
}

export interface PesoResuelto {
  fecha: string;
  peso_kg: number;
  /** Tabla que gano. */
  origen: OrigenPeso;
  /** source de cuerpo_log o fuente de biometricas_dia, sin normalizar. */
  fuente: string | null;
  /** true si la otra tabla tambien tenia peso ese dia y difiere de forma apreciable. */
  hay_conflicto: boolean;
  /** Peso de la tabla que perdio, para poder auditar sin ir a la base. */
  peso_alterno_kg: number | null;
  /** peso_kg - peso_alterno_kg, redondeado a 2 decimales. null si no hay alterno. */
  diff_kg: number | null;
}

/**
 * Diferencia a partir de la cual las dos fuentes se consideran en conflicto.
 * Por debajo es ruido de balanza (misma medicion redondeada distinto) y marcar
 * conflicto solo generaria alarmas falsas.
 */
export const CONFLICTO_UMBRAL_KG = 0.3;

/**
 * Peso valido o null. Las columnas numeric de Supabase pueden llegar como
 * string, y un peso de 0 o negativo es dato basura, no una medicion.
 */
function pesoValido(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Instante de la fila para desempatar, en ms. Sin timestamps devuelve null. */
function instanteFila(f: FilaPesoCuerpo): number | null {
  for (const t of [f.updated_at, f.created_at]) {
    if (typeof t === 'string' && t) {
      const ms = Date.parse(t);
      if (Number.isFinite(ms)) return ms;
    }
  }
  return null;
}

/**
 * Elige la fila de cuerpo_log que representa el peso de esa fecha.
 * cuerpo_log es append-only, asi que puede haber varias mediciones el mismo
 * dia. Gana la mas reciente por updated_at/created_at; si ninguna trae
 * timestamps, gana la ultima del arreglo (el GET del endpoint ordena por fecha
 * desc, pero dentro de una misma fecha el orden lo pone Postgres, asi que sin
 * timestamps esto es una convencion, no una garantia).
 */
function ultimaMedicionDelDia(filas: FilaPesoCuerpo[]): FilaPesoCuerpo | null {
  let mejor: FilaPesoCuerpo | null = null;
  let mejorMs = -Infinity;
  for (const f of filas) {
    if (pesoValido(f.peso_kg) === null) continue;
    // Sin timestamp la fila queda en -Infinity: desplaza a otra sin timestamp
    // (con >= gana la ultima del arreglo) pero nunca a una que si tenga fecha.
    const orden = instanteFila(f) ?? -Infinity;
    if (mejor === null || orden >= mejorMs) {
      mejor = f;
      mejorMs = orden;
    }
  }
  return mejor;
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Peso de una fecha, con cuerpo_log ganandole a biometricas_dia.
 *
 * Recibe las filas YA filtradas o no: se queda solo con las de `fecha`, asi que
 * se le puede pasar el resultado crudo de cada tabla.
 *
 * Devuelve null si ninguna de las dos tiene peso valido ese dia. No inventa,
 * no interpola, no arrastra el peso del dia anterior: eso es decision de quien
 * consume (ver ultimoPesoConocido).
 */
export function pesoDelDia(
  fecha: string,
  cuerpo: FilaPesoCuerpo[],
  biometricas: FilaPesoBiometrica[],
): PesoResuelto | null {
  const filaCuerpo = ultimaMedicionDelDia(cuerpo.filter((f) => f.fecha === fecha));
  const filaBio = biometricas.find((f) => f.fecha === fecha && pesoValido(f.peso_kg) !== null) ?? null;

  const pesoCuerpo = filaCuerpo ? pesoValido(filaCuerpo.peso_kg) : null;
  const pesoBio = filaBio ? pesoValido(filaBio.peso_kg) : null;

  if (pesoCuerpo === null && pesoBio === null) return null;

  // La regla, en una linea: cuerpo_log manda, biometricas_dia rellena.
  const gana: OrigenPeso = pesoCuerpo !== null ? 'cuerpo_log' : 'biometricas_dia';
  const peso = pesoCuerpo !== null ? pesoCuerpo : (pesoBio as number);
  const alterno = pesoCuerpo !== null ? pesoBio : null;
  const diff = alterno === null ? null : redondear2(peso - alterno);

  return {
    fecha,
    peso_kg: peso,
    origen: gana,
    fuente: gana === 'cuerpo_log' ? (filaCuerpo?.source ?? null) : (filaBio?.fuente ?? null),
    hay_conflicto: diff !== null && Math.abs(diff) >= CONFLICTO_UMBRAL_KG,
    peso_alterno_kg: alterno,
    diff_kg: diff,
  };
}

/**
 * Serie de peso resuelto, un punto por fecha que tenga peso en alguna de las
 * dos tablas. Ordenada por fecha descendente (mas reciente primero), igual que
 * responde GET /api/salud/cuerpo.
 *
 * Sirve para graficos y promedios moviles sin que la serie se corte en los
 * dias que solo tienen dato de Google Health.
 */
export function serieDePeso(
  cuerpo: FilaPesoCuerpo[],
  biometricas: FilaPesoBiometrica[],
): PesoResuelto[] {
  const fechas = new Set<string>();
  for (const f of cuerpo) if (pesoValido(f.peso_kg) !== null) fechas.add(f.fecha);
  for (const f of biometricas) if (pesoValido(f.peso_kg) !== null) fechas.add(f.fecha);

  const out: PesoResuelto[] = [];
  for (const fecha of fechas) {
    const r = pesoDelDia(fecha, cuerpo, biometricas);
    if (r) out.push(r);
  }
  // Las fechas son YYYY-MM-DD, asi que el orden lexicografico es el cronologico.
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/**
 * Peso mas reciente en o antes de `hoy`, con los dias de antiguedad.
 *
 * Pensado para el header de Salud y el dashboard: si Pancho no se peso hoy,
 * mostrar "82.4 kg (hace 3 dias)" es mucho mas util que un guion, pero el
 * consumidor tiene que poder decir "esto ya esta viejo". Por eso devuelve
 * dias_atras en vez de fingir que el dato es de hoy.
 */
export function ultimoPesoConocido(
  hoy: string,
  cuerpo: FilaPesoCuerpo[],
  biometricas: FilaPesoBiometrica[],
): (PesoResuelto & { dias_atras: number }) | null {
  const serie = serieDePeso(cuerpo, biometricas).filter((p) => p.fecha <= hoy);
  const ultimo = serie[0];
  if (!ultimo) return null;
  const ms = Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${ultimo.fecha}T12:00:00Z`);
  const dias = Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
  return { ...ultimo, dias_atras: Math.max(0, dias) };
}

/**
 * Dias donde las dos tablas tienen peso y discrepan por encima del umbral.
 * Herramienta de auditoria: no cambia nada, solo permite mirar cuanto se
 * estaban peleando las dos fuentes antes de que existiera esta regla.
 */
export function conflictosDePeso(serie: PesoResuelto[]): PesoResuelto[] {
  return serie.filter((p) => p.hay_conflicto);
}

/*
 * ── RECETA DE CABLEADO (cuando se porten las rutas a TanStack) ─────────────
 *
 * En el GET de la ruta portada de /api/salud/cuerpo (hoy
 * src/pages/api/salud/cuerpo.ts), sumar biometricas_dia a la consulta y
 * devolver el resuelto SIN sacar nada de la respuesta actual, para no romper
 * a OSSaludCuerpo.tsx, OSSaludDashboard.tsx ni OSOnboardingBanner.tsx, que
 * hoy leen `mediciones`:
 *
 *   const [cuerpo, bio] = await Promise.all([
 *     sb.from('cuerpo_log').select('*').order('fecha', { ascending: false }).limit(365),
 *     sb.from('biometricas_dia').select('fecha, peso_kg, fuente').order('fecha', { ascending: false }).limit(365),
 *   ]);
 *   const hoy = hoyGuayaquil();
 *   return json({
 *     mediciones: cuerpo.data ?? [],          // igual que hoy, no se toca
 *     peso_hoy: pesoDelDia(hoy, cuerpo.data ?? [], bio.data ?? []),
 *     peso_ultimo: ultimoPesoConocido(hoy, cuerpo.data ?? [], bio.data ?? []),
 *     peso_serie: serieDePeso(cuerpo.data ?? [], bio.data ?? []),
 *   });
 *
 * /api/biometricas no necesita cambio alguno: sigue siendo el ingreso crudo de
 * fuentes externas.
 *
 * Mismo tratamiento para el GET de /api/salud/progreso, que hoy arma la serie
 * de peso corporal leyendo solo cuerpo_log: cambiar esa serie por serieDePeso()
 * cierra los huecos de los dias que solo tienen dato de Google Health.
 *
 * Si en algun momento se quiere exponer esto por MCP, es un tool de LECTURA
 * nuevo sobre el mismo GET (src/mcp/osTools.ts). No se toca cuerpo_registrar
 * ni biometricas_registrar.
 */
