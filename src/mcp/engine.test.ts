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
