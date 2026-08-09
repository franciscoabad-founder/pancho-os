import type { APIRoute } from 'astro';
import { handleMcpStatelessRequest, type McpJsonRpcRequest } from '../../mcp/engine';

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
  'salud/sueno/config', 'salud/sueno/hoy', 'salud/sueno/index', 'semana',
  'system', 'tareas',
]);

function toToolRequest(name: string, args: Record<string, unknown>): ToolRequest {
  switch (name) {
    case 'agenda_get_eventos': {
      const query = new URLSearchParams();
      if (typeof args.fecha_inicio === 'string') query.set('desde', args.fecha_inicio);
      if (typeof args.fecha_fin === 'string') query.set('hasta', args.fecha_fin);
      return { path: `/api/agenda${query.size ? `?${query}` : ''}`, method: 'GET' };
    }
    case 'agenda_create_evento': {
      const date = String(args.fecha ?? '');
      const start = typeof args.hora_inicio === 'string' ? `${date}T${args.hora_inicio}:00` : date;
      const end = typeof args.hora_fin === 'string' ? `${date}T${args.hora_fin}:00` : undefined;
      return { path: '/api/agenda', method: 'POST', body: { titulo: args.titulo, fecha: start, fin: end, descripcion: args.descripcion } };
    }
    case 'agenda_delete_evento':
      return { path: `/api/agenda?id=${encodeURIComponent(String(args.evento_id ?? ''))}`, method: 'DELETE' };
    case 'tareas_list':
      return { path: '/api/tareas', method: 'GET' };
    case 'tareas_create':
      return { path: '/api/tareas', method: 'POST', body: { titulo: args.titulo, prioridad: args.prioridad, deadline: args.fecha_limite } };
    case 'finanzas_log_gasto':
      return { path: '/api/gastos', method: 'POST', body: { monto: args.monto, categoria: args.categoria, descripcion: args.descripcion } };
    case 'nutricion_buscar_alimentos': {
      const query = new URLSearchParams();
      if (typeof args.consulta === 'string') query.set('q', args.consulta);
      if (typeof args.codigo_barras === 'string') query.set('barcode', args.codigo_barras);
      if (typeof args.modo === 'string') query.set('modo', args.modo);
      return { path: `/api/salud/alimentos${query.size ? `?${query}` : ''}`, method: 'GET' };
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
    case 'os_api_request': {
      const module = String(args.module ?? '');
      const method = String(args.method ?? '').toUpperCase();
      if (!MCP_OS_MODULES.has(module) || !['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        throw new Error('os_api_request solo permite tareas, agenda o gastos con un método HTTP válido.');
      }
      const query = args.query && typeof args.query === 'object' ? new URLSearchParams(args.query as Record<string, string>) : new URLSearchParams();
      return { path: `/api/${module}${query.size ? `?${query}` : ''}`, method, body: args.body as Record<string, unknown> | undefined };
    }
    case 'gbrain_search_memory':
      throw new Error('Usa el MCP de gbrain directamente para buscar memoria.');
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

  // Validación de seguridad de la petición stateless
  if (!expectedToken || tokenHeader !== expectedToken) {
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
