// Integracion del handshake MCP con bearer OAuth: un token vivo se resuelve por
// mcpAuth y el motor responde initialize -> tools/list, con las anotaciones
// (readOnlyHint / destructiveHint) que los clientes estandar necesitan.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { autenticarMcp } from './mcpAuth.ts';
import { handleMcpStatelessRequest, esHerramientaSoloLectura } from './engine.ts';
import { setClienteSupabaseOauth } from '../server/oauth.handlers.ts';
import { hashOpaco, ACCESS_TOKEN_TTL_S } from '../server/oauthCrypto.ts';

type Fila = Record<string, unknown>;

function clienteTokens(filas: Fila[]): SupabaseClient {
  function builder() {
    const filtros: Array<(f: Fila) => boolean> = [];
    const self = {
      select() { return self; },
      eq(campo: string, valor: unknown) { filtros.push((f) => f[campo] === valor); return self; },
      maybeSingle() {
        const r = filas.filter((f) => filtros.every((fn) => fn(f)))[0] ?? null;
        return Promise.resolve({ data: r, error: null });
      },
    };
    return self;
  }
  return { from: () => builder() } as unknown as SupabaseClient;
}

function reqConBearer(token: string): Request {
  return new Request('https://os.franciscoabad.com/api/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'MCP-Protocol-Version': '2025-06-18' },
  });
}

test('handshake OAuth: bearer vivo -> initialize (ecoa protocolVersion) -> tools/list con anotaciones', async () => {
  const token = 'tok-handshake';
  const previoApi = process.env.OS_API_TOKEN;
  process.env.OS_API_TOKEN = 'maestro-distinto'; // que el token NO sea el estatico
  setClienteSupabaseOauth(() => clienteTokens([{
    access_token_hash: hashOpaco(token),
    client_id: 'mcp_gemini',
    scope: 'read write',
    actor: 'Gemini',
    expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000).toISOString(),
    revoked_at: null,
  }]));

  try {
    // 1. Auth por bearer OAuth.
    const auth = await autenticarMcp(reqConBearer(token));
    assert.equal(auth.ok, true);
    if (!auth.ok) return;
    assert.equal(auth.identidad.actorNombrado, 'Gemini');
    assert.equal(auth.identidad.scope, 'read write');

    // 2. initialize ecoa la protocolVersion del cliente.
    const init = await handleMcpStatelessRequest(
      { jsonrpc: '2.0', id: 'init', method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } },
      new Headers(),
    );
    const initResult = init.result as { protocolVersion: string; capabilities: Record<string, unknown>; serverInfo: { name: string } };
    assert.equal(initResult.protocolVersion, '2025-06-18');
    assert.ok(initResult.capabilities.tools, 'debe anunciar capacidad de tools');
    assert.equal(initResult.serverInfo.name, 'pancho-os');

    // 3. tools/list trae anotaciones coherentes.
    const list = await handleMcpStatelessRequest(
      { jsonrpc: '2.0', id: 'list', method: 'tools/list' },
      new Headers(),
    );
    const tools = (list.result as { tools: Array<{ name: string; annotations?: Record<string, boolean> }> }).tools;
    assert.ok(tools.length > 0);

    const tareasList = tools.find((t) => t.name === 'tareas_list');
    const tareasCreate = tools.find((t) => t.name === 'tareas_create');
    assert.equal(tareasList?.annotations?.readOnlyHint, true, 'tareas_list es solo lectura');
    assert.equal(tareasCreate?.annotations?.destructiveHint, true, 'tareas_create es destructiva');
    assert.equal(esHerramientaSoloLectura('tareas_list'), true);
    assert.equal(esHerramientaSoloLectura('agenda_delete_evento'), false);

    // Toda tool tiene alguna de las dos hints.
    for (const t of tools) {
      const a = t.annotations ?? {};
      assert.ok(a.readOnlyHint === true || a.destructiveHint === true, `${t.name} sin anotacion`);
    }
  } finally {
    setClienteSupabaseOauth(null);
    if (previoApi === undefined) delete process.env.OS_API_TOKEN;
    else process.env.OS_API_TOKEN = previoApi;
  }
});
