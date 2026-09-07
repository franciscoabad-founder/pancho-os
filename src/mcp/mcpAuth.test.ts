// Autenticacion del MCP: token estatico, bearer OAuth, y el 401 con
// WWW-Authenticate que dispara el descubrimiento OAuth en los conectores.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { autenticarMcp, cabeceraWwwAuthenticate, RECURSO_MCP_METADATA } from './mcpAuth.ts';
import { setClienteSupabaseOauth, TABLA_TOKENS } from '../server/oauth.handlers.ts';
import { hashOpaco, ACCESS_TOKEN_TTL_S } from '../server/oauthCrypto.ts';

type Fila = Record<string, unknown>;

// Doble minimo para resolverAccessToken: from(tokens).select().eq().maybeSingle().
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

const ENV = ['OS_API_TOKEN', 'OS_API_TOKENS'] as const;
function conEnv(valores: Partial<Record<(typeof ENV)[number], string>>, fn: () => Promise<void>) {
  const previo = ENV.map((k) => [k, process.env[k]] as const);
  for (const k of ENV) delete process.env[k];
  for (const [k, v] of Object.entries(valores)) process.env[k] = v;
  return fn().finally(() => {
    for (const [k, v] of previo) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

function req(headers: Record<string, string>): Request {
  return new Request('https://os.franciscoabad.com/api/mcp', { method: 'POST', headers });
}

test('autenticarMcp acepta el token maestro estatico con scope total y sin actor', async () => {
  await conEnv({ OS_API_TOKEN: 'maestro' }, async () => {
    setClienteSupabaseOauth(() => clienteTokens([]));
    try {
      const r = await autenticarMcp(req({ 'X-OS-Token': 'maestro' }));
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.equal(r.identidad.actorNombrado, null);
      assert.equal(r.identidad.scope, 'read write');
      assert.equal(r.identidad.esOauth, false);
    } finally { setClienteSupabaseOauth(null); }
  });
});

test('autenticarMcp propaga el nombre de una key de OS_API_TOKENS', async () => {
  await conEnv({ OS_API_TOKEN: 'maestro', OS_API_TOKENS: 'kimi:abc123' }, async () => {
    setClienteSupabaseOauth(() => clienteTokens([]));
    try {
      const r = await autenticarMcp(req({ authorization: 'Bearer abc123' }));
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.equal(r.identidad.actorNombrado, 'kimi');
      assert.equal(r.identidad.esOauth, false);
    } finally { setClienteSupabaseOauth(null); }
  });
});

test('autenticarMcp resuelve un bearer OAuth a su actor y scope', async () => {
  await conEnv({ OS_API_TOKEN: 'maestro' }, async () => {
    const token = 'tok-oauth-vivo';
    setClienteSupabaseOauth(() => clienteTokens([{
      access_token_hash: hashOpaco(token),
      client_id: 'mcp_gemini',
      scope: 'read write',
      actor: 'Gemini',
      expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000).toISOString(),
      revoked_at: null,
    }]));
    try {
      const r = await autenticarMcp(req({ authorization: `Bearer ${token}` }));
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.equal(r.identidad.actorNombrado, 'Gemini');
      assert.equal(r.identidad.scope, 'read write');
      assert.equal(r.identidad.esOauth, true);
    } finally { setClienteSupabaseOauth(null); }
  });
});

test('autenticarMcp devuelve 401 con WWW-Authenticate cuando no hay token', async () => {
  await conEnv({ OS_API_TOKEN: 'maestro' }, async () => {
    setClienteSupabaseOauth(() => clienteTokens([]));
    try {
      const r = await autenticarMcp(req({}));
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(r.response.status, 401);
      const www = r.response.headers.get('WWW-Authenticate');
      assert.ok(www && www.includes(RECURSO_MCP_METADATA), 'el 401 debe apuntar al oauth-protected-resource');
    } finally { setClienteSupabaseOauth(null); }
  });
});

test('autenticarMcp devuelve 401 con un token que no es estatico ni un OAuth vivo', async () => {
  await conEnv({ OS_API_TOKEN: 'maestro' }, async () => {
    setClienteSupabaseOauth(() => clienteTokens([])); // ningun token OAuth
    try {
      const r = await autenticarMcp(req({ authorization: 'Bearer desconocido' }));
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(r.response.status, 401);
    } finally { setClienteSupabaseOauth(null); }
  });
});

test('cabeceraWwwAuthenticate arma el Bearer con resource_metadata', () => {
  const h = cabeceraWwwAuthenticate();
  assert.match(h, /^Bearer resource_metadata="https:\/\/os\.franciscoabad\.com\/\.well-known\/oauth-protected-resource"$/);
});
