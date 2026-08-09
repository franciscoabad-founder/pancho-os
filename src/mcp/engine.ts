export interface McpRequestMeta {
  protocolVersion?: string;
  clientCapabilities?: Record<string, unknown>;
  inputResponses?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
    _meta?: McpRequestMeta;
    [key: string]: unknown;
  };
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiresMRTR?: boolean;
}

export type McpToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

// Catálogo de herramientas semánticas del Pancho OS (spec 2026-07-28)
export const SEMANTIC_TOOLS: McpToolDefinition[] = [
  {
    name: 'agenda_get_eventos',
    description: 'Consulta los eventos de la agenda de Pancho OS dentro de un rango de fechas.',
    inputSchema: {
      type: 'object',
      properties: {
        fecha_inicio: { type: 'string', description: 'Fecha inicial YYYY-MM-DD' },
        fecha_fin: { type: 'string', description: 'Fecha final YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'agenda_create_evento',
    description: 'Crea una nueva reunión o evento en la agenda.',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título de la reunión' },
        fecha: { type: 'string', description: 'Fecha del evento YYYY-MM-DD' },
        hora_inicio: { type: 'string', description: 'Hora inicio HH:mm' },
        hora_fin: { type: 'string', description: 'Hora fin HH:mm' },
        descripcion: { type: 'string', description: 'Descripción o notas' },
      },
      required: ['titulo', 'fecha'],
    },
  },
  {
    name: 'agenda_delete_evento',
    description: 'Elimina un evento de la agenda de Pancho OS. Acción sensible con MRTR.',
    requiresMRTR: true,
    inputSchema: {
      type: 'object',
      properties: {
        evento_id: { type: 'string', description: 'ID del evento a eliminar' },
        razon: { type: 'string', description: 'Motivo de la cancelación' },
      },
      required: ['evento_id'],
    },
  },
  {
    name: 'tareas_list',
    description: 'Obtiene el listado de tareas pendientes o completadas.',
    inputSchema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['pendientes', 'completadas', 'todas'] },
        categoria: { type: 'string', description: 'Categoría opcional' },
      },
    },
  },
  {
    name: 'tareas_create',
    description: 'Crea una nueva tarea pendiente en Pancho OS.',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Nombre de la tarea' },
        prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] },
        fecha_limite: { type: 'string', description: 'Fecha límite YYYY-MM-DD' },
      },
      required: ['titulo'],
    },
  },
  {
    name: 'finanzas_log_gasto',
    description: 'Registra un movimiento financiero de gasto.',
    requiresMRTR: true,
    inputSchema: {
      type: 'object',
      properties: {
        monto: { type: 'number', description: 'Monto del gasto' },
        categoria: { type: 'string', description: 'Categoría (comida, transporte, etc.)' },
        descripcion: { type: 'string', description: 'Detalle del gasto' },
      },
      required: ['monto', 'categoria'],
    },
  },
  {
    name: 'gbrain_search_memory',
    description: 'Busca conocimiento o notas en G-Brain / Cerebro de Pancho OS.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Término de búsqueda o pregunta de contexto' },
      },
      required: ['query'],
    },
  },
  {
    name: 'os_api_request',
    description: 'Fallback proxy genérico para interactuar con cualquier módulo de Pancho OS.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string', description: 'Módulo de la API de Pancho OS' },
        method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'DELETE'] },
        query: { type: 'object', additionalProperties: { type: 'string' } },
        body: { type: 'object', additionalProperties: true },
      },
      required: ['module', 'method'],
    },
  },
];

// Motor Stateless RPC (spec 2026-07-28)
export async function handleMcpStatelessRequest(
  reqBody: McpJsonRpcRequest,
  headers: Headers,
  executeTool?: McpToolExecutor,
): Promise<Record<string, unknown>> {
  const methodFromHeader = headers.get('Mcp-Method');
  const method = methodFromHeader || reqBody.method;
  const requestId = reqBody.id ?? 1;

  // Handshake MCP estándar. Hermes inicia toda conexión HTTP con este método
  // antes de descubrir herramientas, aunque el servidor sea sin estado.
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: requestId,
      result: {
        protocolVersion: typeof reqBody.params?.protocolVersion === 'string'
          ? reqBody.params.protocolVersion
          : '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'pancho-os', version: '0.0.1' },
      },
    };
  }

  // Un cliente MCP envía esta notificación tras initialize. La ruta HTTP
  // siempre devuelve JSON, por lo que confirmamos la recepción vacía.
  if (method === 'notifications/initialized') {
    return { jsonrpc: '2.0', result: {} };
  }

  // 1. tools/list: Retorna catálogo cacheable con ttlMs y cacheScope
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: requestId,
      result: {
        tools: SEMANTIC_TOOLS.map(({ requiresMRTR, ...tool }) => tool),
        ttlMs: 3600000, // 1 hora de caché para el cliente IA
        cacheScope: 'global',
      },
    };
  }

  // 2. tools/call: Ejecuta herramienta indicada
  if (method === 'tools/call') {
    const toolName = headers.get('Mcp-Name') || reqBody.params?.name;
    const toolArgs = reqBody.params?.arguments || {};
    const meta = reqBody.params?._meta || {};

    if (!toolName) {
      return {
        jsonrpc: '2.0',
        id: requestId,
        error: { code: -32602, message: 'Missing tool name (Mcp-Name header or params.name required)' },
      };
    }

    const toolDef = SEMANTIC_TOOLS.find((t) => t.name === toolName);

    // Verificación MRTR (Multi Round-Trip Request) para acciones sensibles
    if (toolDef?.requiresMRTR) {
      const inputResponses = meta.inputResponses || toolArgs.inputResponses;
      if (!inputResponses || (inputResponses as Record<string, unknown>).confirm !== true) {
        return {
          jsonrpc: '2.0',
          id: requestId,
          result: {
            resultType: 'input_required',
            prompt: `[Confirmación de Seguridad MRTR] ¿Estás seguro de que deseas ejecutar la acción sensible '${toolName}'?`,
            fields: [
              {
                name: 'confirm',
                type: 'boolean',
                description: 'Establecer en true para proceder',
              },
            ],
          },
        };
      }
    }

    // Ejecución de herramientas
    switch (toolName) {
      case 'agenda_get_eventos':
      case 'agenda_create_evento':
      case 'agenda_delete_evento':
      case 'tareas_list':
      case 'tareas_create':
      case 'finanzas_log_gasto':
      case 'gbrain_search_memory': {
        if (executeTool) {
          try {
            const data = await executeTool(toolName, toolArgs);
            return {
              jsonrpc: '2.0',
              id: requestId,
              result: {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ ...data, tool: toolName }, null, 2),
                }],
              },
            };
          } catch (err) {
            return {
              jsonrpc: '2.0',
              id: requestId,
              error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
            };
          }
        }
        return {
          jsonrpc: '2.0',
          id: requestId,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'success',
                  tool: toolName,
                  execution: 'Stateless HTTP 2026-07-28',
                  receivedArgs: toolArgs,
                  timestamp: new Date().toISOString(),
                }, null, 2),
              },
            ],
          },
        };
      }

      case 'os_api_request': {
        return {
          jsonrpc: '2.0',
          id: requestId,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'success',
                  message: 'Fallback proxy executado correctamente',
                  args: toolArgs,
                }, null, 2),
              },
            ],
          },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id: requestId,
          error: { code: -32601, message: `Tool not found: ${toolName}` },
        };
    }
  }

  // Fallback para métodos no reconocidos
  return {
    jsonrpc: '2.0',
    id: requestId,
    error: { code: -32601, message: `Unsupported method: ${method}` },
  };
}
