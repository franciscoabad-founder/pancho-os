// Cumplimiento del protocolo MCP 2026-07-28 en el motor stateless.
// Cubre: server/discover, camino stateless por _meta (sin initialize previo),
// resultType/serverInfo en cada result, codigos de error renumerados y la forma
// MRTR (inputRequests/requestState). Retrocompat con 2025-06-18 incluida.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleMcpStatelessRequest,
  SERVER_INFO,
  VERSIONES_SOPORTADAS,
  CODIGO_HEADER_MISMATCH,
  CODIGO_UNSUPPORTED_PROTOCOL_VERSION,
} from './engine.ts';

const SERVER_INFO_KEY = 'io.modelcontextprotocol/serverInfo';
const VERSION_KEY = 'io.modelcontextprotocol/protocolVersion';
const CAPS_KEY = 'io.modelcontextprotocol/clientCapabilities';

test('server/discover anuncia versiones soportadas, capabilities e identidad', async () => {
  const res = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'disc-1', method: 'server/discover', params: { _meta: { [VERSION_KEY]: '2026-07-28' } } },
    new Headers(),
  );
  const result = res.result as {
    resultType: string;
    supportedVersions: string[];
    capabilities: Record<string, unknown>;
    instructions: string;
    ttlMs: number;
    cacheScope: string;
    _meta: Record<string, unknown>;
  };
  assert.equal(result.resultType, 'complete');
  assert.deepEqual(result.supportedVersions, [...VERSIONES_SOPORTADAS]);
  assert.ok(result.supportedVersions.includes('2026-07-28'));
  assert.ok(result.supportedVersions.includes('2025-06-18'));
  assert.ok(result.capabilities.tools, 'debe anunciar tools');
  assert.deepEqual(result.capabilities.extensions, {}, 'capabilities.extensions presente (aunque vacio)');
  assert.equal(result.cacheScope, 'public');
  assert.equal(typeof result.ttlMs, 'number');
  assert.deepEqual(result._meta[SERVER_INFO_KEY], SERVER_INFO);
});

test('camino stateless: tools/call con _meta funciona sin initialize previo', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const res = await handleMcpStatelessRequest(
    {
      jsonrpc: '2.0',
      id: 'stateless-1',
      method: 'tools/call',
      params: {
        name: 'tareas_list',
        arguments: { estado: 'pendientes' },
        _meta: {
          [VERSION_KEY]: '2026-07-28',
          [CAPS_KEY]: {},
          'io.modelcontextprotocol/clientInfo': { name: 'gemini', version: '2.0' },
        },
      },
    },
    new Headers(),
    async (name, args) => { calls.push({ name, args }); return { tareas: [] }; },
  );
  assert.deepEqual(calls, [{ name: 'tareas_list', args: { estado: 'pendientes' } }]);
  const result = res.result as { resultType: string; _meta: Record<string, unknown> };
  assert.equal(result.resultType, 'complete');
  assert.deepEqual(result._meta[SERVER_INFO_KEY], SERVER_INFO);
});

test('tools/list trae resultType complete, serverInfo en _meta, ttlMs y cacheScope', async () => {
  const res = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'list-1', method: 'tools/list' },
    new Headers(),
  );
  const result = res.result as { resultType: string; ttlMs: number; cacheScope: string; _meta: Record<string, unknown>; tools: unknown[] };
  assert.equal(result.resultType, 'complete');
  assert.equal(result.cacheScope, 'public');
  assert.equal(typeof result.ttlMs, 'number');
  assert.deepEqual(result._meta[SERVER_INFO_KEY], SERVER_INFO);
  assert.ok(Array.isArray(result.tools) && result.tools.length > 0);
});

test('tools/list mantiene orden determinista entre llamadas', async () => {
  const a = await handleMcpStatelessRequest({ jsonrpc: '2.0', id: 'o1', method: 'tools/list' }, new Headers());
  const b = await handleMcpStatelessRequest({ jsonrpc: '2.0', id: 'o2', method: 'tools/list' }, new Headers());
  const nombres = (r: Record<string, unknown>) => (r.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
  assert.deepEqual(nombres(a), nombres(b));
});

test('version no soportada -> UnsupportedProtocolVersionError (-32022) con supported/requested', async () => {
  const res = await handleMcpStatelessRequest(
    {
      jsonrpc: '2.0',
      id: 'ver-1',
      method: 'tools/list',
      params: { _meta: { [VERSION_KEY]: '1900-01-01' } },
    },
    new Headers(),
  );
  const err = res.error as { code: number; data: { supported: string[]; requested: string } };
  assert.equal(err.code, CODIGO_UNSUPPORTED_PROTOCOL_VERSION);
  assert.equal(err.code, -32022);
  assert.equal(err.data.requested, '1900-01-01');
  assert.deepEqual(err.data.supported, [...VERSIONES_SOPORTADAS]);
});

test('retrocompat: version legacy 2025-06-18 en _meta se acepta', async () => {
  const res = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'ver-legacy', method: 'tools/list', params: { _meta: { [VERSION_KEY]: '2025-06-18' } } },
    new Headers(),
  );
  assert.equal('error' in res, false);
  assert.equal((res.result as { resultType: string }).resultType, 'complete');
});

test('sin version declarada se acepta (clientes que aun no la mandan)', async () => {
  const res = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'ver-none', method: 'tools/list' },
    new Headers(),
  );
  assert.equal('error' in res, false);
});

test('HeaderMismatch (-32020): Mcp-Method del header discrepa del method del body', async () => {
  const res = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'hm-1', method: 'tools/call' },
    new Headers({ 'Mcp-Method': 'tools/list' }),
  );
  const err = res.error as { code: number };
  assert.equal(err.code, CODIGO_HEADER_MISMATCH);
  assert.equal(err.code, -32020);
});

test('HeaderMismatch (-32020): Mcp-Name del header discrepa de params.name', async () => {
  const res = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'hm-2', method: 'tools/call', params: { name: 'tareas_list' } },
    new Headers({ 'Mcp-Name': 'agenda_get_eventos' }),
  );
  assert.equal((res.error as { code: number }).code, CODIGO_HEADER_MISMATCH);
});

test('MRTR: InputRequiredResult lleva resultType input_required y requestState opaco', async () => {
  const res = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'mrtr-1', method: 'tools/call', params: { name: 'agenda_delete_evento', arguments: { evento_id: 'e1' } } },
    new Headers(),
    async () => ({ ok: true }),
  );
  const result = res.result as { resultType: string; requestState: string; inputRequests?: unknown };
  assert.equal(result.resultType, 'input_required');
  assert.equal(typeof result.requestState, 'string');
  // Sin capability de elicitation declarada, NO se mandan inputRequests (req. 7).
  assert.equal(result.inputRequests, undefined);
});

test('MRTR: con capability elicitation declarada se incluye inputRequests con elicitation/create', async () => {
  const res = await handleMcpStatelessRequest(
    {
      jsonrpc: '2.0',
      id: 'mrtr-2',
      method: 'tools/call',
      params: {
        name: 'agenda_delete_evento',
        arguments: { evento_id: 'e1' },
        _meta: { [CAPS_KEY]: { elicitation: {} } },
      },
    },
    new Headers(),
    async () => ({ ok: true }),
  );
  const result = res.result as { resultType: string; inputRequests: Record<string, { method: string }> };
  assert.equal(result.resultType, 'input_required');
  assert.ok(result.inputRequests.confirmacion, 'debe pedir la confirmacion');
  assert.equal(result.inputRequests.confirmacion.method, 'elicitation/create');
});

test('MRTR: retry con inputResponses.confirmacion.action=accept ejecuta la accion', async () => {
  const calls: string[] = [];
  const res = await handleMcpStatelessRequest(
    {
      jsonrpc: '2.0',
      id: 'mrtr-3',
      method: 'tools/call',
      params: {
        name: 'agenda_delete_evento',
        arguments: { evento_id: 'e1' },
        _meta: { inputResponses: { confirmacion: { action: 'accept', content: { confirm: true } } } },
      },
    },
    new Headers(),
    async (name) => { calls.push(name); return { ok: true }; },
  );
  assert.deepEqual(calls, ['agenda_delete_evento']);
  assert.equal((res.result as { resultType: string }).resultType, 'complete');
});

test('MRTR: retrocompat Hermes con confirm:true plano sigue ejecutando', async () => {
  const calls: string[] = [];
  const res = await handleMcpStatelessRequest(
    { jsonrpc: '2.0', id: 'mrtr-4', method: 'tools/call', params: { name: 'agenda_delete_evento', arguments: { evento_id: 'e1', confirm: true } } },
    new Headers(),
    async (name) => { calls.push(name); return { ok: true }; },
  );
  assert.deepEqual(calls, ['agenda_delete_evento']);
  assert.equal('error' in res, false);
});
