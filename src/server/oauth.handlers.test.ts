// Reglas de negocio del OAuth del MCP sin Supabase real: se inyecta un doble en
// memoria via setClienteSupabaseOauth (mismo seam que devices.handlers.test.ts).
//
// Foco: lo que la logica pura (oauthCrypto.test.ts) no cubre porque depende de
// estado en la base:
//   - un codigo se canjea UNA sola vez (candado used_at);
//   - un codigo vencido no se canjea;
//   - el redirect_uri del canje tiene que coincidir con el del codigo;
//   - el scope del token sale del codigo (que salio del cliente registrado);
//   - resolverAccessToken rechaza revocado y expirado;
//   - el refresh rota (la fila vieja queda revocada) y no se reusa;
//   - un cliente confidencial exige su secreto correcto.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TABLA_CLIENTS,
  TABLA_CODES,
  TABLA_TOKENS,
  ErrorOauth,
  setClienteSupabaseOauth,
  registrarCliente,
  emitirCodigo,
  canjearCodigo,
  refrescar,
  resolverAccessToken,
  revocarToken,
  verificarCredencialCliente,
  obtenerCliente,
} from './oauth.handlers.ts';
import { calcularS256, hashOpaco } from './oauthCrypto.ts';

type Fila = Record<string, unknown>;

// Doble minimo del query builder de supabase-js, generico por tabla. Cubre solo
// lo que oauth.handlers.ts usa: insert / select / update, eq / is, maybeSingle,
// y el thenable para `update(...).select()` awaited directo.
function crearClienteFake(db: Record<string, Fila[]>): SupabaseClient {
  function builder(nombre: string) {
    const filas = db[nombre] ?? (db[nombre] = []);
    let modo: 'select' | 'insert' | 'update' = 'select';
    const filtros: Array<(f: Fila) => boolean> = [];
    let insertRows: Fila[] = [];
    let updateValues: Fila = {};
    let maybeSingleFlag = false;
    let singleFlag = false;

    async function ejecutar(): Promise<{ data: unknown; error: unknown }> {
      if (modo === 'insert') {
        const nuevas = insertRows.map((r) => ({ ...r }));
        // Emula unicidad de claves primarias/unique de las tres tablas.
        for (const r of nuevas) {
          const clash =
            (nombre === TABLA_CLIENTS && filas.some((f) => f.client_id === r.client_id)) ||
            (nombre === TABLA_CODES && filas.some((f) => f.code_hash === r.code_hash)) ||
            (nombre === TABLA_TOKENS && filas.some((f) => f.access_token_hash === r.access_token_hash));
          if (clash) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        filas.push(...nuevas);
        return { data: nuevas, error: null };
      }

      if (modo === 'update') {
        const coincidencias = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of coincidencias) Object.assign(f, updateValues);
        return { data: coincidencias, error: null };
      }

      const resultado = filas.filter((f) => filtros.every((fn) => fn(f)));
      if (singleFlag) {
        return resultado[0]
          ? { data: resultado[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      }
      if (maybeSingleFlag) return { data: resultado[0] ?? null, error: null };
      return { data: resultado, error: null };
    }

    const self = {
      select() { return self; },
      insert(rows: Fila[]) { modo = 'insert'; insertRows = rows; return self; },
      update(values: Fila) { modo = 'update'; updateValues = values; return self; },
      eq(campo: string, valor: unknown) { filtros.push((f) => f[campo] === valor); return self; },
      is(campo: string, valor: null) { filtros.push((f) => (f[campo] ?? null) === valor); return self; },
      maybeSingle() { maybeSingleFlag = true; return ejecutar(); },
      single() { singleFlag = true; return ejecutar(); },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return ejecutar().then(resolve, reject);
      },
    };
    return self;
  }
  return { from: (nombre: string) => builder(nombre) } as unknown as SupabaseClient;
}

function conDb(fn: (db: Record<string, Fila[]>) => Promise<void>) {
  const db: Record<string, Fila[]> = { [TABLA_CLIENTS]: [], [TABLA_CODES]: [], [TABLA_TOKENS]: [] };
  setClienteSupabaseOauth(() => crearClienteFake(db));
  return fn(db).finally(() => setClienteSupabaseOauth(null));
}

const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = calcularS256(VERIFIER);
const REDIRECT = 'https://cliente.example.com/callback';

async function registrarYCodigo(db: Record<string, Fila[]>, opts: { scopes?: string[]; scopePedido?: string; publico?: boolean } = {}) {
  const cli = await registrarCliente({
    client_name: 'Gemini',
    redirect_uris: [REDIRECT],
    scopes: opts.scopes ?? ['read', 'write'],
    publico: opts.publico ?? true,
  });
  const cliente = await obtenerCliente(cli.client_id);
  const code = await emitirCodigo({
    cliente: cliente!,
    redirectUri: REDIRECT,
    scope: opts.scopePedido ?? '',
    codeChallenge: CHALLENGE,
    codeChallengeMethod: 'S256',
    actor: cliente!.client_name,
  });
  return { cli, cliente: cliente!, code };
}

// --- canje de un solo uso ----------------------------------------------------

test('canjearCodigo emite tokens la primera vez y falla la segunda (un solo uso)', async () => {
  await conDb(async (db) => {
    const { cli, code } = await registrarYCodigo(db);
    const tokens = await canjearCodigo({ code, clientId: cli.client_id, redirectUri: REDIRECT, codeVerifier: VERIFIER });
    assert.equal(tokens.token_type, 'Bearer');
    assert.ok(tokens.access_token.length > 0);
    assert.ok(tokens.refresh_token.length > 0);
    assert.equal(tokens.expires_in, 3600);

    await assert.rejects(
      () => canjearCodigo({ code, clientId: cli.client_id, redirectUri: REDIRECT, codeVerifier: VERIFIER }),
      (err: unknown) => err instanceof ErrorOauth && err.error === 'invalid_grant',
    );
  });
});

test('canjearCodigo rechaza un codigo vencido', async () => {
  await conDb(async (db) => {
    const { cli, code } = await registrarYCodigo(db);
    // Forzar el vencimiento de la fila del codigo.
    db[TABLA_CODES][0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    await assert.rejects(
      () => canjearCodigo({ code, clientId: cli.client_id, redirectUri: REDIRECT, codeVerifier: VERIFIER }),
      (err: unknown) => err instanceof ErrorOauth && /vencio/.test(err.message),
    );
  });
});

test('canjearCodigo rechaza un redirect_uri distinto al del codigo', async () => {
  await conDb(async (db) => {
    const { cli, code } = await registrarYCodigo(db);
    await assert.rejects(
      () => canjearCodigo({ code, clientId: cli.client_id, redirectUri: 'https://otro.example.com/cb', codeVerifier: VERIFIER }),
      (err: unknown) => err instanceof ErrorOauth && err.error === 'invalid_grant',
    );
  });
});

test('canjearCodigo rechaza un code_verifier que no valida el PKCE', async () => {
  await conDb(async (db) => {
    const { cli, code } = await registrarYCodigo(db);
    await assert.rejects(
      () => canjearCodigo({ code, clientId: cli.client_id, redirectUri: REDIRECT, codeVerifier: 'x'.repeat(50) }),
      (err: unknown) => err instanceof ErrorOauth && /PKCE/.test(err.message),
    );
  });
});

test('canjearCodigo rechaza un codigo de otro cliente', async () => {
  await conDb(async (db) => {
    const { code } = await registrarYCodigo(db);
    await assert.rejects(
      () => canjearCodigo({ code, clientId: 'mcp_otro', redirectUri: REDIRECT, codeVerifier: VERIFIER }),
      (err: unknown) => err instanceof ErrorOauth && err.error === 'invalid_grant',
    );
  });
});

// --- scope del token ---------------------------------------------------------

test('el scope del token sale del cliente: pedir write con cliente read-only es invalid_scope', async () => {
  await conDb(async (db) => {
    await assert.rejects(
      () => registrarYCodigo(db, { scopes: ['read'], scopePedido: 'write' }),
      (err: unknown) => err instanceof Error && /invalid_scope/.test(err.message),
    );
  });
});

test('el token conserva el scope resuelto del codigo (default read)', async () => {
  await conDb(async (db) => {
    const { cli, code } = await registrarYCodigo(db, { scopes: ['read', 'write'], scopePedido: '' });
    const tokens = await canjearCodigo({ code, clientId: cli.client_id, redirectUri: REDIRECT, codeVerifier: VERIFIER });
    assert.equal(tokens.scope, 'read');
    const ident = await resolverAccessToken(tokens.access_token);
    assert.equal(ident?.scope, 'read');
    assert.equal(ident?.actor, 'Gemini');
  });
});

// --- resolverAccessToken -----------------------------------------------------

test('resolverAccessToken devuelve actor y scope de un token vivo, null de uno revocado o expirado', async () => {
  await conDb(async (db) => {
    const { cli, code } = await registrarYCodigo(db, { scopes: ['read', 'write'], scopePedido: 'read write' });
    const tokens = await canjearCodigo({ code, clientId: cli.client_id, redirectUri: REDIRECT, codeVerifier: VERIFIER });

    const vivo = await resolverAccessToken(tokens.access_token);
    assert.equal(vivo?.actor, 'Gemini');
    assert.equal(vivo?.scope, 'read write');
    assert.equal(vivo?.clientId, cli.client_id);

    // Expirado.
    db[TABLA_TOKENS][0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    assert.equal(await resolverAccessToken(tokens.access_token), null);

    // Revocado.
    db[TABLA_TOKENS][0]!.expires_at = new Date(Date.now() + 60000).toISOString();
    db[TABLA_TOKENS][0]!.revoked_at = new Date().toISOString();
    assert.equal(await resolverAccessToken(tokens.access_token), null);

    // Token inexistente.
    assert.equal(await resolverAccessToken('no-existe'), null);
  });
});

// --- refresh -----------------------------------------------------------------

test('refrescar rota: emite un par nuevo y deja el refresh viejo inutil', async () => {
  await conDb(async (db) => {
    const { cli, code } = await registrarYCodigo(db, { scopes: ['read', 'write'], scopePedido: 'read write' });
    const t1 = await canjearCodigo({ code, clientId: cli.client_id, redirectUri: REDIRECT, codeVerifier: VERIFIER });

    const t2 = await refrescar(t1.refresh_token, cli.client_id);
    assert.notEqual(t2.access_token, t1.access_token);
    assert.notEqual(t2.refresh_token, t1.refresh_token);
    assert.equal(t2.scope, 'read write');

    // El refresh viejo ya no sirve (la fila quedo revocada).
    await assert.rejects(
      () => refrescar(t1.refresh_token, cli.client_id),
      (err: unknown) => err instanceof ErrorOauth && err.error === 'invalid_grant',
    );
    // El nuevo si.
    const ident = await resolverAccessToken(t2.access_token);
    assert.equal(ident?.actor, 'Gemini');
  });
});

test('revocarToken invalida el access token (RFC 7009)', async () => {
  await conDb(async (db) => {
    const { cli, code } = await registrarYCodigo(db);
    const tokens = await canjearCodigo({ code, clientId: cli.client_id, redirectUri: REDIRECT, codeVerifier: VERIFIER });
    assert.ok(await resolverAccessToken(tokens.access_token));
    await revocarToken(tokens.access_token);
    assert.equal(await resolverAccessToken(tokens.access_token), null);
  });
});

// --- clientes confidenciales -------------------------------------------------

test('verificarCredencialCliente exige el secreto correcto en un cliente confidencial', async () => {
  await conDb(async () => {
    const reg = await registrarCliente({ client_name: 'ConfClient', redirect_uris: [REDIRECT], scopes: ['read'] });
    assert.ok(reg.client_secret, 'un cliente no publico debe traer secret');
    const cliente = await obtenerCliente(reg.client_id);
    assert.equal(verificarCredencialCliente(cliente!, reg.client_secret), true);
    assert.equal(verificarCredencialCliente(cliente!, 'secreto-malo'), false);
    assert.equal(verificarCredencialCliente(cliente!, null), false);
    // El secret solo se guarda hasheado.
    assert.equal(cliente!.client_secret_hash, hashOpaco(reg.client_secret!));
  });
});

test('un cliente publico (solo PKCE) no lleva secret y no lo exige', async () => {
  await conDb(async () => {
    const reg = await registrarCliente({ client_name: 'Publico', redirect_uris: [REDIRECT], scopes: ['read'], publico: true });
    assert.equal(reg.client_secret, null);
    const cliente = await obtenerCliente(reg.client_id);
    assert.equal(cliente!.client_secret_hash, null);
    assert.equal(verificarCredencialCliente(cliente!, null), true);
  });
});
