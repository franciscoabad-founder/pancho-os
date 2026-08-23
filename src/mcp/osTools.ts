// Traduccion de herramientas MCP a requests de la API del OS.
//
// Vivia dentro de src/pages/api/mcp.ts (Astro). Se extrajo aca al portar el
// endpoint a TanStack Start (src/routes/api/mcp.ts): la logica es identica,
// pero tenerla en un modulo sin imports de framework evita mantener dos copias
// del mismo allowlist y del mismo mapeo de herramientas mientras los dos
// endpoints conviven durante la migracion. Igual que engine.ts, este modulo no
// sabe si lo llama Astro o Start.

import { readEnv } from '../lib/env.ts';
import { hoyGuayaquil } from '../lib/salud/apiHelpers.ts';

export type ToolRequest = { path: string; method: string; body?: Record<string, unknown> };

const MCP_OS_MODULES = new Set([
  // 'comidas' retirado (22-ago-2026): pagina 301-redirigida a
  // /salud/nutricion desde hace tiempo, cero callers de UI confirmados por
  // grep, pero seguia en este allowlist -- un agente podia escribir en una
  // tabla que nadie mira. El endpoint api/comidas.ts se deja vivo por
  // ahora (no se confirmaron cero llamadores EXTERNOS al repo, ej. n8n);
  // se retira del todo en Fase 2 si se confirma que no hace falta.
  //
  // 'salud/rutinas' y 'salud/ejercicios' retirados (22-ago-2026): eran el
  // motor de entrenamiento viejo (tablas rutinas / rutina_ejercicios /
  // ejercicios) que quedo solapado con GFIT (gfit_rutinas / gfit_dias /
  // gfit_dia_ejercicios / ejercicios_catalogo). La pagina que los consumia,
  // /salud/entrenamiento (OSSaludEntrenamiento.tsx), es huerfana de
  // navegacion: OSSaludNav.astro enlaza "Entreno" a /gfit, no a ella.
  // Verificado contra la base antes de retirar: rutinas = 1 fila semilla
  // ("Full Body Casa", created_at == updated_at del seed del 15-jul-2026),
  // rutina_ejercicios = 4 filas del mismo seed, ejercicios = 235 filas
  // creadas todas en los batches de seed de ese mismo dia y ninguna tocada
  // despues (cero filas posteriores al seed en las tres tablas), y sets_log,
  // que solo escribe este flujo viejo, en 0. GFIT en cambio si tiene uso
  // real: 5 gfit_rutinas, 5 gfit_dias, 21 gfit_dia_ejercicios, 25
  // gfit_series_plan y 12 gfit_logros creados en fechas distintas
  // (16-jul y 24-jul). Sin filas reales que perder, se corta el acceso de
  // agentes para que nadie escriba en tablas que ningun humano mira.
  // 'salud/sesiones' se queda: aunque hoy este vacia, es la tabla de sesiones
  // que usa GFIT (gfit_registrar_serie la abre y gfit/progreso la lee).
  //
  // Los endpoints Astro src/pages/api/salud/rutinas.ts y ejercicios.ts NO se
  // portan a TanStack a proposito: quedan fuera del alcance del port y se
  // dejan morir con Astro en master. No crear src/routes/api/salud/rutinas.ts
  // ni ejercicios.ts. Ojo: este allowlist lo comparten el endpoint MCP de
  // Astro (src/pages/api/mcp.ts) y el de Start (src/routes/api/mcp.ts), asi
  // que el retiro aplica a los dos.
  'agenda', 'aprobaciones', 'bandeja', 'biometricas', 'contenido',
  'cuentas', 'deudas', 'dia', 'gastos', 'gfit/catalogo', 'gfit/config',
  'gfit/dia-ejercicios', 'gfit/dias', 'gfit/logros', 'gfit/progreso',
  'gfit/rutinas', 'gfit/series', 'gfit/sesion-series', 'habitos',
  'habitos/brief', 'habitos/checks', 'habitos/cierre', 'habitos/journeys',
  'juego/cierre', 'juego/estado', 'juego/quests', 'juego/recompensas',
  'kpis', 'leads', 'lineas', 'notas', 'objetivos', 'onboarding', 'pendientes',
  'por-cobrar', 'presupuestos', 'priority-stack', 'recordatorios',
  'redes-metricas', 'revision', 'salud/alimentos', 'salud/ayunos',
  'salud/comidas-log', 'salud/config', 'salud/cuerpo',
  'salud/estiramiento', 'salud/insights', 'salud/meals', 'salud/progreso',
  'salud/recetas', 'salud/sesiones', 'salud/sueno/cafeina',
  'salud/sueno/config', 'salud/sueno/hoy', 'salud/sueno', 'semana',
  'system', 'tareas',
]);

// La API de tareas guarda prioridades en ingles; el catalogo MCP habla espanol.
const PRIORIDAD_MCP: Record<string, string> = { baja: 'low', media: 'medium', alta: 'high', critica: 'critical' };

export function toToolRequest(name: string, args: Record<string, unknown>): ToolRequest {
  switch (name) {
    case 'agenda_get_eventos': {
      const query = new URLSearchParams();
      if (typeof args.fecha_inicio === 'string') query.set('desde', args.fecha_inicio);
      if (typeof args.fecha_fin === 'string') query.set('hasta', args.fecha_fin);
      return { path: `/api/agenda${query.size ? `?${query}` : ''}`, method: 'GET' };
    }
    case 'agenda_create_evento': {
      // Offset explicito de Guayaquil: sin el, Postgres interpreta el
      // timestamp naive como UTC y un evento de 09:00 se guarda a las 04:00.
      const date = String(args.fecha ?? '');
      const start = typeof args.hora_inicio === 'string' ? `${date}T${args.hora_inicio}:00-05:00` : date;
      const end = typeof args.hora_fin === 'string' ? `${date}T${args.hora_fin}:00-05:00` : undefined;
      return { path: '/api/agenda', method: 'POST', body: { titulo: args.titulo, fecha: start, fin: end, descripcion: args.descripcion } };
    }
    case 'agenda_delete_evento':
      return { path: `/api/agenda?id=${encodeURIComponent(String(args.evento_id ?? ''))}`, method: 'DELETE' };
    case 'tareas_list':
      return { path: '/api/tareas', method: 'GET' };
    case 'tareas_create':
      return { path: '/api/tareas', method: 'POST', body: { titulo: args.titulo, prioridad: PRIORIDAD_MCP[String(args.prioridad)] ?? args.prioridad, deadline: args.fecha_limite } };
    // `moneda` es opcional y aditiva: si el agente no la manda, el handler
    // asume USD (la base del OS) y el body queda identico al de antes.
    case 'finanzas_log_gasto':
      return {
        path: '/api/gastos',
        method: 'POST',
        body: {
          monto: args.monto,
          categoria: args.categoria,
          descripcion: args.descripcion,
          ...(typeof args.moneda === 'string' && args.moneda.trim() ? { moneda: args.moneda.trim().toUpperCase() } : {}),
        },
      };
    case 'nutricion_buscar_alimentos': {
      // Acepta alias comunes del termino de busqueda: los agentes mandan
      // query/q/texto y antes se descartaban en silencio, devolviendo el
      // catalogo completo como si fuera un resultado valido.
      const consulta = [args.consulta, args.query, args.q, args.texto].find((v) => typeof v === 'string' && v.trim());
      const query = new URLSearchParams();
      if (typeof consulta === 'string') query.set('q', consulta.trim());
      if (typeof args.codigo_barras === 'string') query.set('barcode', args.codigo_barras);
      if (typeof args.modo === 'string') query.set('modo', args.modo);
      if (!query.size) throw new Error('Falta el termino: pasa consulta (texto a buscar), codigo_barras o modo.');
      return { path: `/api/salud/alimentos?${query}`, method: 'GET' };
    }
    case 'nutricion_resumen_dia': {
      const query = new URLSearchParams();
      if (typeof args.fecha === 'string') query.set('dia', args.fecha);
      return { path: `/api/salud/comidas-log${query.size ? `?${query}` : ''}`, method: 'GET' };
    }
    case 'nutricion_registrar_comida':
      return {
        path: '/api/salud/comidas-log',
        method: 'POST',
        body: {
          fecha: args.fecha,
          momento: args.momento,
          alimento_id: args.alimento_id,
          cantidad_g: args.cantidad_g,
          descripcion_libre: args.descripcion_libre,
          kcal: args.kcal,
          proteina_g: args.proteina_g,
          carbos_g: args.carbos_g,
          grasa_g: args.grasa_g,
          notas: args.notas,
          source: 'agente',
        },
      };
    case 'inbox_listar': {
      const query = new URLSearchParams();
      if (typeof args.leido === 'boolean') query.set('leido', args.leido ? '1' : '0');
      return { path: `/api/bandeja${query.size ? `?${query}` : ''}`, method: 'GET' };
    }
    case 'inbox_capturar':
      return { path: '/api/bandeja', method: 'POST', body: { titulo: args.titulo, url: args.url, descripcion: args.descripcion, categoria: args.categoria } };
    case 'aprobaciones_listar': {
      const query = new URLSearchParams();
      if (typeof args.estado === 'string') query.set('estado', args.estado);
      return { path: `/api/aprobaciones${query.size ? `?${query}` : ''}`, method: 'GET' };
    }
    case 'aprobaciones_solicitar':
      return { path: '/api/aprobaciones', method: 'POST', body: { titulo: args.titulo, contexto: args.contexto, opciones: args.opciones, recomendacion: args.recomendacion } };
    case 'contenido_listar': {
      const query = new URLSearchParams();
      if (typeof args.estado === 'string') query.set('status', args.estado);
      return { path: `/api/contenido${query.size ? `?${query}` : ''}`, method: 'GET' };
    }
    case 'contenido_capturar':
      return { path: '/api/contenido', method: 'POST', body: { titulo: args.titulo, formato: args.formato, idea_madre: args.idea_madre, plataformas: args.plataformas, url_referencia: args.url_referencia, transcript: args.transcript } };
    case 'prioridades_semana': {
      const query = new URLSearchParams();
      if (typeof args.semana_inicio === 'string') query.set('semana', args.semana_inicio);
      return { path: `/api/priority-stack${query.size ? `?${query}` : ''}`, method: 'GET' };
    }
    // No fusionar con prioridades_semana: ver comentario del catalogo en
    // engine.ts (SEMANTIC_TOOLS). /api/semana usa el mismo nombre de query
    // ('semana') que /api/priority-stack pero son endpoints distintos.
    case 'semana_diseno': {
      const query = new URLSearchParams();
      if (typeof args.semana_inicio === 'string') query.set('semana', args.semana_inicio);
      return { path: `/api/semana${query.size ? `?${query}` : ''}`, method: 'GET' };
    }
    case 'crm_listar_leads':
      return { path: '/api/leads', method: 'GET' };
    case 'crm_crear_lead':
      return { path: '/api/leads', method: 'POST', body: { nombre: args.nombre, empresa: args.empresa, proyecto: args.proyecto, etapa: args.etapa, valor: args.valor, notas: args.notas } };
    case 'finanzas_listar_gastos':
      return { path: '/api/gastos', method: 'GET' };
    case 'os_api_request': {
      const module = String(args.module ?? '');
      const method = String(args.method ?? '').toUpperCase();
      if (!MCP_OS_MODULES.has(module) || !['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        throw new Error('Modulo o metodo no permitido para os_api_request. Usa una herramienta semantica cuando exista.');
      }
      const query = args.query && typeof args.query === 'object' ? new URLSearchParams(args.query as Record<string, string>) : new URLSearchParams();
      // GET/DELETE con body revientan en undici con un TypeError opaco.
      const body = ['GET', 'DELETE'].includes(method) ? undefined : (args.body as Record<string, unknown> | undefined);
      return { path: `/api/${module}${query.size ? `?${query}` : ''}`, method, body };
    }
    case 'ayuno_iniciar':
      return {
        path: '/api/salud/ayunos',
        method: 'POST',
        body: { inicio: args.inicio, protocolo: args.protocolo, objetivo_horas: args.objetivo_horas, notas: args.notas },
      };
    case 'ayuno_terminar': {
      // PATCH sin id aplica al ayuno abierto (contrato del endpoint).
      const body: Record<string, unknown> = { fin: typeof args.fin === 'string' && args.fin.trim() ? args.fin : new Date().toISOString() };
      if (typeof args.inicio === 'string' && args.inicio.trim()) body.inicio = args.inicio;
      if (typeof args.notas === 'string') body.notas = args.notas;
      return { path: '/api/salud/ayunos', method: 'PATCH', body };
    }
    case 'sueno_hoy':
      return { path: '/api/salud/sueno/hoy', method: 'GET' };
    case 'sueno_registrar':
      return {
        path: '/api/salud/sueno',
        method: 'POST',
        body: {
          inicio: args.inicio,
          fin: args.fin,
          siesta: args.siesta,
          calidad: args.calidad,
          notas: args.notas,
          fuente: args.fuente,
        },
      };
    case 'biometricas_registrar':
      // El endpoint MERGEA por fecha: mandar solo las metricas presentes evita
      // que un registro parcial (solo pasos) borre el peso que ya estaba.
      return {
        path: '/api/biometricas',
        method: 'POST',
        body: {
          fecha: args.fecha,
          pasos: args.pasos,
          sueno_min: args.sueno_min,
          peso_kg: args.peso_kg,
          fc_reposo: args.fc_reposo,
          fuente: args.fuente,
        },
      };
    case 'biometricas_listar': {
      const query = new URLSearchParams();
      for (const k of ['desde', 'hasta', 'fecha'] as const) {
        if (typeof args[k] === 'string' && args[k]) query.set(k, String(args[k]));
      }
      return { path: `/api/biometricas${query.size ? `?${query}` : ''}`, method: 'GET' };
    }
    case 'cuerpo_registrar':
      return {
        path: '/api/salud/cuerpo',
        method: 'POST',
        body: {
          fecha: args.fecha,
          peso_kg: args.peso_kg,
          grasa_pct: args.grasa_pct,
          musculo_kg: args.musculo_kg,
          agua_pct: args.agua_pct,
          cintura_cm: args.cintura_cm,
          notas: args.notas,
          source: args.source,
        },
      };
    case 'gfit_registrar_serie': {
      // String().trim() igual que tareas_update (osTools.ts case tareas_update): un
      // valor de solo espacios pasaba el chequeo falsy anterior, llegaba igual al
      // endpoint (sesion-series.ts tambien usa `if (!body.sesion_id)`, mismo hueco) y
      // terminaba en un 502 opaco de Supabase por FK invalida en vez de este mensaje.
      const sesionId = String(args.sesion_id ?? '').trim();
      const ejercicioId = String(args.ejercicio_id ?? '').trim();
      if (!sesionId) throw new Error('sesion_id requerido: se abre con os_api_request module salud/sesiones method POST body {tipo:"gym"}, tomando el id de sesion.id en la respuesta (no existe gfit/sesiones).');
      if (!ejercicioId) throw new Error('ejercicio_id requerido: sale de dia_ejercicios (campo ejercicio_id) en gfit_dia_hoy, o del catalogo completo con os_api_request module gfit/catalogo.');
      // El catalogo (engine.ts) promete "al menos una medicion" igual que
      // cuerpo_registrar, pero a diferencia de ese caso ni este tool ni el
      // endpoint (sesion-series.ts) lo chequeaban: una llamada con solo los
      // ids pasaba y quedaba una fila con peso_kg/reps/duracion_s en null en
      // gfit_sesion_series, la tabla que alimenta volumen/1RM/recovery en
      // /api/gfit/progreso. Mismo molde que tareas_update (osTools.ts).
      if (args.peso_kg == null && args.peso == null && args.reps == null && args.duracion_s == null) {
        throw new Error('Nada que registrar: pasa al menos una medicion (peso_kg, peso, reps o duracion_s).');
      }
      return {
        path: '/api/gfit/sesion-series',
        method: 'POST',
        body: {
          sesion_id: sesionId,
          dia_ejercicio_id: args.dia_ejercicio_id,
          ejercicio_id: ejercicioId,
          tipo: args.tipo,
          peso_kg: args.peso_kg,
          peso: args.peso,
          unidad: args.unidad,
          reps: args.reps,
          duracion_s: args.duracion_s,
          orden: args.orden,
        },
      };
    }
    case 'tareas_update': {
      const id = String(args.id ?? '').trim();
      if (!id) throw new Error('id de tarea requerido (usa tareas_list para obtenerlo).');
      const patch: Record<string, unknown> = {};
      if (typeof args.estado === 'string') patch.estado = args.estado;
      if (typeof args.prioridad === 'string') patch.prioridad = PRIORIDAD_MCP[args.prioridad] ?? args.prioridad;
      if ('deadline' in args) patch.deadline = args.deadline;
      if (typeof args.titulo === 'string') patch.titulo = args.titulo;
      if (typeof args.urgente === 'boolean') patch.urgente = args.urgente;
      if (!Object.keys(patch).length) throw new Error('Nada que actualizar: pasa estado, prioridad, deadline, titulo o urgente.');
      return { path: `/api/tareas?id=${encodeURIComponent(id)}`, method: 'PATCH', body: patch };
    }
    default:
      throw new Error(`Herramienta MCP no soportada: ${name}`);
  }
}

// GET interno autenticado contra el propio servidor. Comparte credenciales con
// executeOsTool pero se usa aparte para las herramientas compuestas (gfit_dia_hoy,
// gfit_consultar_progreso) que necesitan mas de un request para armar la respuesta.
async function fetchOsJson(request: Request, headers: Headers, path: string): Promise<Record<string, unknown>> {
  const response = await fetch(new URL(path, request.url), { method: 'GET', headers });
  const data = await response.json().catch(() => ({ error: `Respuesta no JSON HTTP ${response.status}` }));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : `OS API HTTP ${response.status}`);
  return data as Record<string, unknown>;
}

// Weekday ISO de hoy en Guayaquil (1=lunes...7=domingo), misma convencion que
// WEEKDAY_LABEL en os/components/gfit/tipos.ts y que gfit_dias.weekday (validado
// 1-7 en routes/api/gfit/dias.ts). OJO: es distinta a la convencion de
// OSGfitProgreso.tsx (lunes=0..domingo=6 via (getDay()+6)%7), esa es para otro uso
// (indexar un calendario de 7 columnas), no confundirlas. new Date(y, m-1, d) usa
// componentes locales del proceso, no pasa por UTC, asi que el weekday no depende
// de la zona horaria del server.
export function isoWeekdayHoyGuayaquil(): number {
  const [y, m, d] = hoyGuayaquil().split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 ? 7 : dow;
}

// gfit_dia_hoy no es un mapeo 1:1 como el resto: primero hay que resolver la
// rutina activa y despues buscar entre sus dias el que cae en el weekday de hoy.
// GET /api/gfit/dias ya trae cada dia con sus ejercicios anidados (mismo select
// que /api/gfit/dia-ejercicios: comparar el SEL de routes/api/gfit/dias.ts con el
// de routes/api/gfit/dia-ejercicios.ts, son identicos), asi que no hace falta un
// tercer fetch al detalle -- pedirlo de nuevo solo duplicaria en el payload que
// entra al contexto del agente la misma lista de ejercicios (con imagenes
// incluidas) que ya viene dentro de dia.gfit_dia_ejercicios. Por eso esta funcion
// vive fuera de toToolRequest (que solo arma un ToolRequest, no orquesta varios).
export async function gfitDiaHoy(request: Request, headers: Headers, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const rutinaExplicita = typeof args.rutina_id === 'string' && args.rutina_id.trim() ? args.rutina_id.trim() : null;
  let rutinaId = rutinaExplicita;
  if (!rutinaId) {
    const rutinasData = await fetchOsJson(request, headers, '/api/gfit/rutinas');
    const rutinas = Array.isArray(rutinasData.rutinas) ? (rutinasData.rutinas as Array<Record<string, unknown>>) : [];
    const activa = rutinas[0];
    if (!activa || typeof activa.id !== 'string') {
      return { dia: null, dia_ejercicios: [], mensaje: 'No hay ninguna rutina activa configurada en GFIT.' };
    }
    rutinaId = activa.id;
  }
  // "la rutina activa" solo es correcto cuando la resolvimos nosotros; si el
  // caller paso rutina_id explicito no consultamos ninguna rutina activa.
  const refRutina = rutinaExplicita ? 'La rutina consultada' : 'La rutina activa';

  const diasData = await fetchOsJson(request, headers, `/api/gfit/dias?rutina_id=${encodeURIComponent(rutinaId)}`);
  const dias = Array.isArray(diasData.dias) ? (diasData.dias as Array<Record<string, unknown>>) : [];
  // Los dias tipo 'orden' y 'descanso' se guardan con weekday=null (dias.ts) --
  // nunca van a matchear el weekday de hoy. Si la rutina no tiene NINGUN dia
  // tipo 'weekday', decir "no hay entreno hoy" seria falso (la rutina si
  // tiene dias, solo que numerados en vez de por dia de la semana).
  const usaWeekday = dias.some((d) => d.tipo === 'weekday' || typeof d.weekday === 'number');
  if (dias.length > 0 && !usaWeekday) {
    return {
      dia: null,
      dia_ejercicios: [],
      mensaje: `${refRutina} no organiza sus dias por dia de la semana (es secuencial/orden). No puedo resolver "hoy" automaticamente: usa os_api_request module gfit/dias con query {rutina_id:"${rutinaId}"} para ver la lista completa y decidir cual sigue.`,
    };
  }
  const weekdayHoy = isoWeekdayHoyGuayaquil();
  const diaHoy = dias.find((d) => d.weekday === weekdayHoy);
  if (!diaHoy || typeof diaHoy.id !== 'string') {
    return { dia: null, dia_ejercicios: [], mensaje: `${refRutina} no tiene un dia programado para hoy.` };
  }

  // dia_ejercicios se saca de diaHoy y se quita del objeto dia antes de devolver:
  // si se dejaran las dos claves, el JSON que entra al contexto del agente
  // serializaria la misma lista de ejercicios (con imagenes) dos veces.
  const { gfit_dia_ejercicios, ...diaSinEjercicios } = diaHoy as Record<string, unknown> & { gfit_dia_ejercicios?: unknown };
  return { dia: diaSinEjercicios, dia_ejercicios: gfit_dia_ejercicios ?? [] };
}

// gfit_consultar_progreso combina el dashboard de progreso (volumen, tiempo,
// calendario, 1RM, recuperacion) con el catalogo de logros y cuales ya se
// obtuvieron. Igual que gfit_dia_hoy, son dos GET independientes en paralelo,
// no un solo request.
export async function gfitConsultarProgreso(request: Request, headers: Headers): Promise<Record<string, unknown>> {
  const [progreso, logrosData] = await Promise.all([
    fetchOsJson(request, headers, '/api/gfit/progreso'),
    fetchOsJson(request, headers, '/api/gfit/logros'),
  ]);
  return { progreso, logros: logrosData.logros ?? [] };
}

// Ejecuta la herramienta como una llamada HTTP real contra el propio servidor.
// El origen sale de request.url (la URL absoluta de la request entrante), asi
// que la llamada interna cae en el mismo proceso que atiende /api/* y hereda
// host y esquema publicos. Vale igual en Astro y en TanStack Start: en las dos
// el handler recibe un Request estandar con url absoluta.
export async function executeOsTool(request: Request, name: string, args: Record<string, unknown>) {
  const headers = new Headers({ Accept: 'application/json' });
  const internalToken = readEnv('OS_API_TOKEN');
  if (!internalToken) throw new Error('OS_API_TOKEN no configurado para ejecutar herramientas MCP.');
  headers.set('Authorization', `Bearer ${internalToken}`);
  headers.set('X-OS-Token', internalToken);

  if (name === 'gfit_dia_hoy') return gfitDiaHoy(request, headers, args);
  if (name === 'gfit_consultar_progreso') return gfitConsultarProgreso(request, headers);

  const toolRequest = toToolRequest(name, args);
  if (toolRequest.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(new URL(toolRequest.path, request.url), {
    method: toolRequest.method,
    headers,
    body: toolRequest.body ? JSON.stringify(toolRequest.body) : undefined,
  });
  const data = await response.json().catch(() => ({ error: `Respuesta no JSON HTTP ${response.status}` }));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : `OS API HTTP ${response.status}`);

  if (name === 'tareas_list' && args.estado && Array.isArray(data.tareas)) {
    const estado = args.estado === 'pendientes' ? 'pendiente' : args.estado === 'completadas' ? 'hecho' : null;
    if (estado) data.tareas = data.tareas.filter((tarea: Record<string, unknown>) => tarea.estado === estado);
  }
  return data as Record<string, unknown>;
}
