import assert from 'node:assert/strict';
import test from 'node:test';
import { handleMcpStatelessRequest } from './engine.ts';

test('responde initialize con las capacidades MCP que Hermes necesita para descubrir herramientas', async () => {
  const response = await handleMcpStatelessRequest(
    {
      jsonrpc: '2.0',
      id: 'initialize-1',
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'hermes', version: '0.20.0' } },
    },
    new Headers()
  );

  assert.deepEqual(response, {
    jsonrpc: '2.0',
    id: 'initialize-1',
    result: {
      protocolVersion: '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'pancho-os', version: '0.0.1' },
    },
  });
});

test('acepta notifications/initialized sin tratarla como un método desconocido', async () => {
  const response = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    new Headers()
  );

  assert.deepEqual(response, { jsonrpc: '2.0', result: {} });
});

test('publica herramientas de nutricion para que Hermes pueda consultar y registrar comidas', async () => {
  const response = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'nutrition-tools', method: 'tools/list' },
    new Headers(),
  );

  const toolNames = (response.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);

  assert.deepEqual(
    toolNames.filter((name) => name.startsWith('nutricion_')),
    ['nutricion_buscar_alimentos', 'nutricion_resumen_dia', 'nutricion_registrar_comida'],
  );
});

test('ejecuta el puente universal del OS mediante el ejecutor real', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const response = await handleMcpStatelessRequest(
    {
      jsonrpc: '2.0',
      id: 'os-api-request',
      method: 'tools/call',
      params: { name: 'os_api_request', arguments: { module: 'habitos', method: 'GET' } },
    },
    new Headers(),
    async (name, args) => {
      calls.push({ name, args });
      return { habitos: [{ id: 'hoy' }] };
    },
  );

  assert.deepEqual(calls, [{ name: 'os_api_request', args: { module: 'habitos', method: 'GET' } }]);
  assert.equal(
    (response.result as { content: Array<{ text: string }> }).content[0].text,
    JSON.stringify({ habitos: [{ id: 'hoy' }], tool: 'os_api_request' }, null, 2),
  );
});

test('publica herramientas operativas del OS para inbox, aprobaciones, contenido, prioridades y CRM', async () => {
  const response = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'operaciones-tools', method: 'tools/list' },
    new Headers(),
  );

  const toolNames = (response.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);

  assert.deepEqual(
    [
      'inbox_listar', 'inbox_capturar', 'aprobaciones_listar', 'aprobaciones_solicitar',
      'contenido_listar', 'contenido_capturar', 'prioridades_semana',
      'crm_listar_leads', 'crm_crear_lead', 'finanzas_listar_gastos',
    ].every((name) => toolNames.includes(name)),
    true,
  );
});

test('exige confirmacion para borrar mediante el puente universal del OS', async () => {
  const response = await handleMcpStatelessRequest(
    {
      jsonrpc: '2.0',
      id: 'delete-os-item',
      method: 'tools/call',
      params: { name: 'os_api_request', arguments: { module: 'bandeja', method: 'DELETE', query: { id: '123' } } },
    },
    new Headers(),
    async () => ({ ok: true }),
  );

  assert.equal((response.result as { resultType: string }).resultType, 'input_required');
});

test('ejecuta una herramienta mediante el ejecutor real en vez de responder un mock', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const response = await handleMcpStatelessRequest(
    {
      jsonrpc: '2.0',
      id: 'tareas-1',
      method: 'tools/call',
      params: { name: 'tareas_list', arguments: { estado: 'pendientes' } },
    },
    new Headers(),
    async (name, args) => {
      calls.push({ name, args });
      return { tareas: [{ id: 'real-task', titulo: 'Tarea real' }] };
    },
  );

  assert.deepEqual(calls, [{ name: 'tareas_list', args: { estado: 'pendientes' } }]);
  assert.deepEqual(response, {
    jsonrpc: '2.0',
    id: 'tareas-1',
    result: {
      content: [{
        type: 'text',
        text: JSON.stringify({ tareas: [{ id: 'real-task', titulo: 'Tarea real' }], tool: 'tareas_list' }, null, 2),
      }],
    },
  });
});

test('publica tareas_update para marcar tareas hechas y lo enruta por el ejecutor real', async () => {
  const list = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'update-tools', method: 'tools/list' },
    new Headers(),
  );
  const toolNames = (list.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);
  assert.equal(toolNames.includes('tareas_update'), true);
  assert.equal(toolNames.includes('gbrain_search_memory'), false);

  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  await handleMcpStatelessRequest(
    {
      jsonrpc: '2.0',
      id: 'update-1',
      method: 'tools/call',
      params: { name: 'tareas_update', arguments: { id: 'abc', estado: 'hecho' } },
    },
    new Headers(),
    async (name, args) => {
      calls.push({ name, args });
      return { ok: true };
    },
  );
  assert.deepEqual(calls, [{ name: 'tareas_update', args: { id: 'abc', estado: 'hecho' } }]);
});
