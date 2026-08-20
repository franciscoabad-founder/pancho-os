import type { APIRoute } from 'astro';
import { handleMcpStatelessRequest, type McpJsonRpcRequest } from '../../mcp/engine.ts';
import { esTokenValido } from '../../lib/osTokens.ts';

export const prerender = false;

type ToolRequest = { path: string; method: string; body?: Record<string, unknown> };

const MCP_OS_MODULES = new Set([
  'agenda', 'aprobaciones', 'bandeja', 'biometricas', 'comidas', 'contenido',
  'cuentas', 'deudas', 'dia', 'gastos', 'gfit/catalogo', 'gfit/config',
  'gfit/dia-ejercicios', 'gfit/dias', 'gfit/logros', 'gfit/progreso',
  'gfit/rutinas', 'gfit/series', 'gfit/sesion-series', 'habitos',
  'habitos/brief', 'habitos/checks', 'habitos/cierre', 'habitos/journeys',
  'juego/cierre', 'juego/estado', 'juego/quests', 'juego/recompensas',
  'kpis', 'leads', 'lineas', 'notas', 'objetivos', 'onboarding', 'pendientes',
  'por-cobrar', 'presupuestos', 'priority-stack', 'recordatorios',
  'redes-metricas', 'revision', 'salud/alimentos', 'salud/ayunos',
  'salud/comidas-log', 'salud/config', 'salud/cuerpo', 'salud/ejercicios',
  'salud/estiramiento', 'salud/insights', 'salud/meals', 'salud/progreso',
  'salud/recetas', 'salud/rutinas', 'salud/sesiones', 'salud/sueno/cafeina',
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
    case 'finanzas_log_gasto':
      return { path: '/api/gastos', method: 'POST', body: { monto: args.monto, categoria: args.categoria, descripcion: args.descripcion } };
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

async function executeOsTool(request: Request, name: string, args: Record<string, unknown>) {
  const toolRequest = toToolRequest(name, args);
  const headers = new Headers({ Accept: 'application/json' });
  const internalToken = import.meta.env.OS_API_TOKEN ?? process.env.OS_API_TOKEN;
  if (!internalToken) throw new Error('OS_API_TOKEN no configurado para ejecutar herramientas MCP.');
  headers.set('Authorization', `Bearer ${internalToken}`);
  headers.set('X-OS-Token', internalToken);
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

export const POST: APIRoute = async ({ request }) => {
  const tokenHeader = request.headers.get('X-OS-Token') || request.headers.get('Authorization')?.replace('Bearer ', '');
  const expectedToken = import.meta.env.OS_API_TOKEN || process.env.OS_API_TOKEN;
  const listaTokens = import.meta.env.OS_API_TOKENS || process.env.OS_API_TOKENS;

  // Validación de seguridad de la petición stateless: token maestro o key con
  // nombre por cliente (OS_API_TOKENS).
  if (!expectedToken || !esTokenValido(tokenHeader, expectedToken, listaTokens)) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: Invalid or missing X-OS-Token / Bearer token.' },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const rawBody = await request.json();
    const responsePayload = await handleMcpStatelessRequest(
      rawBody as McpJsonRpcRequest,
      request.headers,
      (name, args) => executeOsTool(request, name, args),
    );

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Mcp-Version': '2026-07-28',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32700, message: `Parse error: ${err instanceof Error ? err.message : String(err)}` },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
