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
      },
      required: ['evento_id'],
    },
  },
  {
    name: 'agenda_actualizar_evento',
    description: 'Actualiza un evento existente de la agenda. Usa el evento_id devuelto por agenda_get_eventos.',
    inputSchema: {
      type: 'object',
      properties: {
        evento_id: { type: 'string', description: 'ID del evento' },
        titulo: { type: 'string' }, fecha: { type: 'string', description: 'YYYY-MM-DD' },
        hora_inicio: { type: 'string', description: 'HH:mm' }, hora_fin: { type: 'string', description: 'HH:mm' },
        descripcion: { type: 'string' }, ubicacion: { type: 'string' }, etiquetas: { type: 'array', items: { type: 'string' } },
      },
      required: ['evento_id'],
    },
  },
  {
    name: 'agenda_sincronizar_google',
    description: 'Sincroniza un rango de agenda con Google Calendar. Puede crear, modificar o cancelar eventos externos, por lo que requiere confirmación MRTR.',
    requiresMRTR: true,
    inputSchema: { type: 'object', properties: { fecha_inicio: { type: 'string' }, fecha_fin: { type: 'string' } } },
  },
  {
    name: 'tareas_list',
    description: 'Obtiene el listado de tareas pendientes o completadas.',
    inputSchema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['pendientes', 'completadas', 'todas'] },
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
        prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'critica'] },
        fecha_limite: { type: 'string', description: 'Fecha límite YYYY-MM-DD' },
      },
      required: ['titulo'],
    },
  },
  {
    name: 'tareas_update',
    description: 'Actualiza una tarea existente: marcar hecha o en progreso, cambiar prioridad, deadline o título. Usa el id que devuelve tareas_list.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id de la tarea (de tareas_list)' },
        estado: { type: 'string', enum: ['pendiente', 'en_progreso', 'hecho'] },
        prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'critica'] },
        deadline: { type: 'string', description: 'Fecha límite YYYY-MM-DD, o null para quitarla' },
        titulo: { type: 'string', description: 'Nuevo título' },
        urgente: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'finanzas_log_gasto',
    description: 'Registra un movimiento financiero de gasto.',
    requiresMRTR: true,
    inputSchema: {
      type: 'object',
      properties: {
        monto: { type: 'number', description: 'Monto del gasto, en la moneda en que se pagó' },
        categoria: { type: 'string', description: 'Categoría (comida, transporte, etc.)' },
        descripcion: { type: 'string', description: 'Detalle del gasto' },
        moneda: { type: 'string', description: 'Código ISO de la moneda pagada (USD, MXN, EUR, COP...). Por defecto USD, la moneda base del OS. El equivalente en USD se calcula automáticamente.' },
      },
      required: ['monto', 'categoria'],
    },
  },
  {
    name: 'nutricion_buscar_alimentos',
    description: 'Busca alimentos del catalogo de Pancho OS por texto, codigo de barras o lista rapida.',
    inputSchema: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Texto a buscar, por ejemplo huevos o ceviche' },
        codigo_barras: { type: 'string', description: 'Codigo de barras opcional' },
        modo: { type: 'string', enum: ['recientes', 'frecuentes', 'favoritos'] },
      },
    },
  },
  {
    name: 'nutricion_resumen_dia',
    description: 'Obtiene comidas registradas, macros, metas y restante de un dia.',
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha YYYY-MM-DD. Omite para hoy en Guayaquil.' },
      },
    },
  },
  {
    name: 'nutricion_registrar_comida',
    description: 'Registra una comida que Pancho indico explicitamente. Usa alimento_id y cantidad_g cuando el alimento este identificado; usa descripcion_libre y macros estimados cuando no lo este.',
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha YYYY-MM-DD. Omite para hoy en Guayaquil.' },
        momento: { type: 'string', enum: ['desayuno', 'almuerzo', 'cena', 'snack'] },
        alimento_id: { type: 'string', description: 'ID obtenido con nutricion_buscar_alimentos' },
        cantidad_g: { type: 'number', description: 'Cantidad consumida en gramos' },
        descripcion_libre: { type: 'string', description: 'Descripcion cuando no hay alimento identificado' },
        kcal: { type: 'number' },
        proteina_g: { type: 'number' },
        carbos_g: { type: 'number' },
        grasa_g: { type: 'number' },
        notas: { type: 'string' },
      },
      required: ['momento'],
    },
  },
  {
    name: 'ayuno_iniciar',
    description: 'Inicia un ayuno. Acepta inicio retroactivo: si Pancho dice "empece a ayunar a las 2pm", pasa ese inicio en ISO con offset -05:00. Si hay un ayuno abierto, se cierra automaticamente al iniciar el nuevo.',
    inputSchema: {
      type: 'object',
      properties: {
        inicio: { type: 'string', description: 'ISO 8601 con zona, ej. 2026-08-15T14:00:00-05:00. Omite para ahora.' },
        protocolo: { type: 'string', enum: ['16_8', '18_6', '20_4', 'omad', 'extendido', 'custom'] },
        objetivo_horas: { type: 'number', description: 'Horas objetivo si el protocolo es custom' },
        notas: { type: 'string' },
      },
    },
  },
  {
    name: 'ayuno_terminar',
    description: 'Termina el ayuno abierto. Acepta fin retroactivo: "termine a las 6pm" pasa ese fin en ISO con offset -05:00. Sin fin, cierra ahora. Tambien corrige el inicio del ayuno abierto si se pasa inicio.',
    inputSchema: {
      type: 'object',
      properties: {
        fin: { type: 'string', description: 'ISO 8601 con zona. Omite para ahora.' },
        inicio: { type: 'string', description: 'Corregir el inicio del ayuno abierto (ISO 8601 con zona)' },
        notas: { type: 'string' },
      },
    },
  },
  {
    name: 'sueno_hoy',
    description: 'Estado de sueno de hoy: deuda acumulada, ventanas del dia y plan de pago con horas concretas. Corre el modelo de dos procesos. Usalo para el brief de la manana y antes de sugerir horarios.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'sueno_registrar',
    description: 'Registra una sesion de sueno o una siesta ya ocurrida. inicio y fin en ISO 8601 con zona horaria.',
    inputSchema: {
      type: 'object',
      properties: {
        inicio: { type: 'string', description: 'Inicio ISO 8601, ej. 2026-08-14T23:30:00-05:00' },
        fin: { type: 'string', description: 'Fin ISO 8601, posterior a inicio' },
        siesta: { type: 'boolean', description: 'true si fue siesta y no el sueno principal' },
        calidad: { type: 'number', description: 'Calidad percibida 1 a 5' },
        notas: { type: 'string' },
        fuente: { type: 'string', description: 'Origen del dato: manual, fitbit, google_health. Default manual.' },
      },
      required: ['inicio', 'fin'],
    },
  },
  {
    name: 'biometricas_registrar',
    description: 'Registra metricas diarias del cuerpo: pasos, minutos de sueno, peso y frecuencia cardiaca en reposo. El upsert MERGEA por fecha, asi que enviar solo pasos no borra el peso ya registrado.',
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'YYYY-MM-DD. Omite para hoy en Guayaquil.' },
        pasos: { type: 'number', description: 'Entero no negativo' },
        sueno_min: { type: 'number', description: 'Minutos dormidos, entero no negativo' },
        peso_kg: { type: 'number', description: 'Mayor a 0' },
        fc_reposo: { type: 'number', description: 'Pulsaciones en reposo, entero no negativo' },
        fuente: { type: 'string', description: 'Origen: manual, fitbit, google_health. Default google_health.' },
      },
    },
  },
  {
    name: 'biometricas_listar',
    description: 'Lista las metricas diarias por rango de fechas. Sin parametros devuelve los ultimos 30 dias.',
    inputSchema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'YYYY-MM-DD' },
        hasta: { type: 'string', description: 'YYYY-MM-DD' },
        fecha: { type: 'string', description: 'Un dia puntual YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'cuerpo_registrar',
    description: 'Registra una medicion corporal: peso, grasa, musculo, agua, cintura. Requiere al menos una medicion.',
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'YYYY-MM-DD. Omite para hoy.' },
        peso_kg: { type: 'number' },
        grasa_pct: { type: 'number' },
        musculo_kg: { type: 'number' },
        agua_pct: { type: 'number' },
        cintura_cm: { type: 'number' },
        notas: { type: 'string' },
        source: { type: 'string', description: 'manual, renpho, fitbit. Default manual.' },
      },
    },
  },
  {
    name: 'inbox_listar',
    description: 'Lista items de la bandeja de entrada canonica del OS.',
    inputSchema: { type: 'object', properties: { leido: { type: 'boolean' } } },
  },
  {
    name: 'inbox_capturar',
    description: 'Guarda una nota, enlace o pedido explicitamente indicado por Pancho en la bandeja canonica del OS.',
    inputSchema: {
      type: 'object',
      properties: { titulo: { type: 'string' }, url: { type: 'string' }, descripcion: { type: 'string' }, categoria: { type: 'string' } },
      required: ['titulo'],
    },
  },
  {
    name: 'aprobaciones_listar',
    description: 'Lista solicitudes pendientes o resueltas de aprobacion en el OS.',
    inputSchema: { type: 'object', properties: { estado: { type: 'string', enum: ['pendiente', 'aprobado', 'rechazado'] } } },
  },
  {
    name: 'aprobaciones_solicitar',
    description: 'Crea una solicitud de aprobacion cuando Hermes propone una accion por iniciativa propia.',
    inputSchema: {
      type: 'object',
      properties: { titulo: { type: 'string' }, contexto: { type: 'string' }, opciones: { type: 'array', items: { type: 'string' } }, recomendacion: { type: 'string' }, expira_at: { type: 'string', description: 'Fecha ISO opcional de expiracion' } },
      required: ['titulo'],
    },
  },
  {
    name: 'aprobaciones_responder',
    description: 'Resuelve una solicitud de aprobacion existente cuando el usuario ya dijo aprobado o rechazado en Hermes.',
    inputSchema: {
      type: 'object',
      properties: {
        aprobacion_id: { type: 'string' },
        estado: { type: 'string', enum: ['aprobado', 'rechazado'] },
        nota: { type: 'string' },
      },
      required: ['aprobacion_id', 'estado'],
    },
  },
  {
    name: 'contenido_listar',
    description: 'Lista ideas de contenido y su estado editorial.',
    inputSchema: { type: 'object', properties: { estado: { type: 'string' } } },
  },
  {
    name: 'contenido_capturar',
    description: 'Guarda una idea de contenido, referencia o transcript que Pancho indico explicitamente.',
    inputSchema: {
      type: 'object',
      properties: { titulo: { type: 'string' }, formato: { type: 'string' }, idea_madre: { type: 'string' }, plataformas: { type: 'array', items: { type: 'string' } }, url_referencia: { type: 'string' }, transcript: { type: 'string' } },
      required: ['titulo'],
    },
  },
  {
    name: 'journal_log',
    description: 'Registra una entrada en el Diario de Pancho: como fue el dia, un proceso que armo, una decision que tomo, un win o una idea. Es la bitacora cruda de la que despues sale contenido y la pagina del dia en el brain. Quedan marcadas con fuente hermes.',
    inputSchema: {
      type: 'object',
      properties: {
        contenido: { type: 'string', description: 'Texto de la entrada, tal como lo dicto Pancho.' },
        tipo: { type: 'string', enum: ['dia', 'proceso', 'decision', 'win', 'idea'], description: 'Que clase de entrada es. Por defecto dia.' },
        titulo: { type: 'string', description: 'Titulo corto opcional.' },
        proyecto: { type: 'string', description: 'Proyecto al que pertenece: braintech, rafik, cortex, taskr, arazza, codeis, marca o personal.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas libres en minusculas.' },
        fecha: { type: 'string', description: 'Fecha YYYY-MM-DD. Omite para hoy.' },
      },
      required: ['contenido'],
    },
  },
  {
    name: 'journal_listar',
    description: 'Lee entradas del Diario de Pancho, opcionalmente de una fecha o de un tipo concreto. Sirve para recordar que hizo un dia antes de responder o de escribir contenido.',
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha YYYY-MM-DD a consultar.' },
        tipo: { type: 'string', enum: ['dia', 'proceso', 'decision', 'win', 'idea'] },
        limit: { type: 'number', description: 'Maximo de entradas a devolver (tope 500).' },
      },
    },
  },
  {
    name: 'prioridades_semana',
    description: 'Consulta las tres prioridades y la lista de no hacer de una semana.',
    inputSchema: { type: 'object', properties: { semana_inicio: { type: 'string', description: 'Lunes YYYY-MM-DD. Omite para semana actual.' } } },
  },
  {
    // No fusionar con prioridades_semana: esa herramienta lee os_priority_stack
    // (las 3 prioridades + lista de no hacer). Esta lee os_semana/os_bloques
    // (el diseno de dias y bloques por funcion). Representan cosas distintas,
    // confirmado en la auditoria original del plan.
    name: 'semana_diseno',
    description: 'Devuelve el diseno de la semana: dias con su modo (maker, manager, off), bloques por funcion (promover, vender, construir, entregar) con la cara derivada y las acciones sugeridas, el balance de horas objetivo vs planificadas vs reales por funcion, y avisos cuando el diseno no le da las horas pedidas o vas atras en la ejecucion.',
    inputSchema: { type: 'object', properties: { semana_inicio: { type: 'string', description: 'Lunes YYYY-MM-DD de la semana a consultar. Omite para la semana actual.' } } },
  },
  {
    name: 'crm_listar_leads',
    description: 'Lista los leads del CRM del OS.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'crm_crear_lead',
    description: 'Crea un lead cuando Pancho lo ordeno explicitamente.',
    inputSchema: {
      type: 'object',
      properties: { nombre: { type: 'string' }, empresa: { type: 'string' }, proyecto: { type: 'string' }, etapa: { type: 'string' }, valor: { type: 'number' }, notas: { type: 'string' } },
      required: ['nombre'],
    },
  },
  {
    name: 'finanzas_listar_gastos',
    description: 'Lista gastos registrados en el OS.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'gfit_dia_hoy',
    description: 'Consulta el dia de entrenamiento de hoy en la rutina activa de GFIT, con sus ejercicios y series planificadas. Resuelve el dia por el weekday de hoy en Guayaquil.',
    inputSchema: {
      type: 'object',
      properties: {
        rutina_id: { type: 'string', description: 'Id de la rutina a consultar. Omite para usar la rutina activa.' },
      },
    },
  },
  {
    name: 'gfit_registrar_serie',
    description: 'Registra una serie ejecutada durante una sesion de entrenamiento de GFIT (peso, reps, tipo). Requiere el sesion_id de la sesion abierta, el ejercicio_id del catalogo, y al menos una medicion (peso_kg, peso, reps o duracion_s).',
    inputSchema: {
      type: 'object',
      properties: {
        sesion_id: { type: 'string', description: 'Id de la sesion de gym abierta. No existe gfit_sesiones: se abre con os_api_request module salud/sesiones method POST body {tipo:"gym"}, y el id sale de sesion.id en la respuesta.' },
        ejercicio_id: { type: 'string', description: 'Id del ejercicio en el catalogo. Sale del campo ejercicio_id de cada item en dia_ejercicios (ver gfit_dia_hoy), o del catalogo completo con os_api_request module gfit/catalogo.' },
        dia_ejercicio_id: { type: 'string', description: 'Id del ejercicio planificado del dia, si la serie viene de la rutina' },
        tipo: { type: 'string', enum: ['warmup', 'working', 'drop', 'failure'], description: 'Tipo de serie. Default working.' },
        peso_kg: { type: 'number', description: 'Peso en kilogramos (canonico)' },
        peso: { type: 'number', description: 'Peso alternativo a peso_kg, junto con unidad' },
        unidad: { type: 'string', enum: ['kg', 'lb'], description: 'Unidad de peso cuando se manda peso en vez de peso_kg' },
        reps: { type: 'number', description: 'Repeticiones realizadas' },
        duracion_s: { type: 'number', description: 'Duracion en segundos para series isometricas o de cardio' },
        orden: { type: 'number', description: 'Orden dentro de la sesion. Omite para agregar al final.' },
      },
      required: ['sesion_id', 'ejercicio_id'],
    },
  },
  {
    name: 'gfit_consultar_progreso',
    description: 'Consulta el progreso de entrenamiento de GFIT: calendario de entrenos, volumen y tiempo por rango, breakdown muscular, top 1RM, estado de recuperacion por grupo y logros obtenidos.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'os_api_request',
    description: 'Puente autenticado a los modulos existentes de Pancho OS. Preferir las herramientas semanticas cuando existan; usar este puente para un modulo del OS aun no cubierto. El module va pelado (tareas, cuentas, salud/sueno), el id va en query.id, nunca en el module. Trampas conocidas: revision usa GET con query.tipo (semanal|mensual|reset90) y escribe con PUT; gfit/dias requiere query.rutina_id; salud/sueno registra con POST; habitos/checks marca con POST {habito_id, fecha}.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string', description: 'Módulo de la API de Pancho OS' },
        method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] },
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
        ttlMs: 300000, // 5 min: con 1h cada fix de catálogo tardaba una hora en verse
        // 'global' no es un valor valido del spec (Hermes lo rechaza con
        // Pydantic: solo 'public'/'private'). El catalogo es identico para
        // cualquier token valido, no depende del usuario -> 'public'.
        cacheScope: 'public',
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
    const isGenericDelete = toolName === 'os_api_request' && String(toolArgs.method ?? '').toUpperCase() === 'DELETE';
    const isGenericGoogleSync = toolName === 'os_api_request' && String(toolArgs.module ?? '') === 'agenda/sync' && String(toolArgs.method ?? '').toUpperCase() === 'POST';
    if (toolDef?.requiresMRTR || isGenericDelete || isGenericGoogleSync) {
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
      case 'agenda_actualizar_evento':
      case 'agenda_sincronizar_google':
      case 'tareas_list':
      case 'tareas_create':
      case 'finanzas_log_gasto':
      case 'nutricion_buscar_alimentos':
      case 'nutricion_resumen_dia':
      case 'nutricion_registrar_comida':
      case 'sueno_hoy':
      case 'sueno_registrar':
      case 'biometricas_registrar':
      case 'biometricas_listar':
      case 'cuerpo_registrar':
      case 'inbox_listar':
      case 'inbox_capturar':
      case 'aprobaciones_listar':
      case 'aprobaciones_solicitar':
      case 'aprobaciones_responder':
      case 'contenido_listar':
      case 'contenido_capturar':
      case 'journal_log':
      case 'journal_listar':
      case 'prioridades_semana':
      case 'semana_diseno':
      case 'crm_listar_leads':
      case 'crm_crear_lead':
      case 'tareas_update':
      case 'ayuno_iniciar':
      case 'ayuno_terminar':
      case 'finanzas_listar_gastos':
      case 'gfit_dia_hoy':
      case 'gfit_registrar_serie':
      case 'gfit_consultar_progreso':
      case 'os_api_request': {
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
