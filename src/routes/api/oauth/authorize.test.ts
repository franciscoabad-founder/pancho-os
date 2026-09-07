// Contrato del endpoint /api/oauth/authorize. Se llama al handler de la server
// route directamente (Route.options.server.handlers), inyectando la sesion por
// env+cookie y un doble de Supabase para el cliente registrado.
//
// Cubre lo que el plan pide para authorize: rechazo sin cookie (302 a /login),
// mas client_id desconocido, redirect_uri no exacto, y el POST que emite el code.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Route } from './authorize.ts';
import { setClienteSupabaseOauth, TABLA_CLIENTS, TABLA_CODES } from '../../../server/oauth.handlers.ts';
import { calcularS256 } from '../../../server/oauthCrypto.ts';

type Fila = Record<string, unknown>;
const handlers = (Route as unknown as { options: { server: { handlers: Record<string, (ctx: { request: Request }) => Promise<Response>> } } }).options.server.handlers;
const GET = handlers.GET;
const POST = handlers.POST;

const REDIRECT = 'https://cliente.example.com/callback';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = calcularS256(VERIFIER);

// Doble que soporta select/eq/maybeSingle sobre clients e insert sobre codes.
function crearCliente(db: Record<string, Fila[]>): SupabaseClient {
  function builder(nombre: string) {
    const filas = db[nombre] ?? (db[nombre] = []);
    const filtros: Array<(f: Fila) => boolean> = [];
    let modo: 'select' | 'insert' = 'select';
    let insertRows: Fila[] = [];
    const self = {
      select() { return self; },
      insert(rows: Fila[]) { modo = 'insert'; insertRows = rows; return self; },
      eq(campo: string, valor: unknown) { filtros.push((f) => f[campo] === valor); return self; },
      is() { return self; },
      maybeSingle() {
        const r = filas.filter((f) => filtros.every((fn) => fn(f)))[0] ?? null;
        return Promise.resolve({ data: r, error: null });
      },
      then(resolve: (v: unknown) => unknown) {
        if (modo === 'insert') { filas.push(...insertRows.map((r) => ({ ...r }))); return Promise.resolve({ data: insertRows, error: null }).then(resolve); }
        return Promise.resolve({ data: filas.filter((f) => filtros.every((fn) => fn(f))), error: null }).then(resolve);
      },
    };
    return self;
  }
  return { from: (n: string) => builder(n) } as unknown as SupabaseClient;
}

function clienteRegistrado(): Fila {
  return {
    client_id: 'mcp_gemini',
    client_secret_hash: null,
    client_name: 'Gemini',
    redirect_uris: [REDIRECT],
    grant_types: ['authorization_code', 'refresh_token'],
    scopes: ['read', 'write'],
    created_at: new Date().toISOString(),
    created_by: 'test',
  };
}

function conSesion(fn: (db: Record<string, Fila[]>) => Promise<void>) {
  const previo = process.env.OS_AUTH_TOKEN;
  process.env.OS_AUTH_TOKEN = 'sess';
  const db: Record<string, Fila[]> = { [TABLA_CLIENTS]: [clienteRegistrado()], [TABLA_CODES]: [] };
  setClienteSupabaseOauth(() => crearCliente(db));
  return fn(db).finally(() => {
    setClienteSupabaseOauth(null);
    if (previo === undefined) delete process.env.OS_AUTH_TOKEN;
    else process.env.OS_AUTH_TOKEN = previo;
  });
}

function urlAuthorize(params: Record<string, string>): string {
  const u = new URL('https://os.franciscoabad.com/api/oauth/authorize');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// --- rechazo sin cookie ------------------------------------------------------

test('GET sin cookie de sesion redirige a /login con next de vuelta al authorize', async () => {
  const previo = process.env.OS_AUTH_TOKEN;
  process.env.OS_AUTH_TOKEN = 'sess';
  try {
    const res = await GET({ request: new Request(urlAuthorize({ client_id: 'mcp_gemini', redirect_uri: REDIRECT, response_type: 'code', code_challenge: CHALLENGE })) });
    assert.equal(res.status, 302);
    const loc = res.headers.get('location') ?? '';
    assert.ok(loc.startsWith('/login?next='), `esperaba redirect a login, fue ${loc}`);
    assert.ok(decodeURIComponent(loc).includes('/api/oauth/authorize'), 'el next debe volver al authorize');
  } finally {
    if (previo === undefined) delete process.env.OS_AUTH_TOKEN;
    else process.env.OS_AUTH_TOKEN = previo;
  }
});

// --- con sesion --------------------------------------------------------------

function conCookie(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers: { cookie: 'os_auth=sess', ...headers } });
}

test('GET con sesion pero client_id desconocido devuelve error 400', async () => {
  await conSesion(async () => {
    const res = await GET({ request: conCookie(urlAuthorize({ client_id: 'no-existe', redirect_uri: REDIRECT, response_type: 'code', code_challenge: CHALLENGE })) });
    assert.equal(res.status, 400);
    assert.match(await res.text(), /client_id desconocido/);
  });
});

test('GET con redirect_uri no registrado (match no exacto) devuelve error 400', async () => {
  await conSesion(async () => {
    const res = await GET({ request: conCookie(urlAuthorize({ client_id: 'mcp_gemini', redirect_uri: `${REDIRECT}/extra`, response_type: 'code', code_challenge: CHALLENGE })) });
    assert.equal(res.status, 400);
    assert.match(await res.text(), /redirect_uri/);
  });
});

test('GET con sesion y parametros validos pinta la pantalla de consentimiento', async () => {
  await conSesion(async () => {
    const res = await GET({ request: conCookie(urlAuthorize({ client_id: 'mcp_gemini', redirect_uri: REDIRECT, response_type: 'code', scope: 'read write', code_challenge: CHALLENGE, code_challenge_method: 'S256' })) });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Gemini/);
    assert.match(html, /Aprobar/);
    assert.match(html, /name="code_challenge"/);
  });
});

// --- POST aprobar ------------------------------------------------------------

function formReq(campos: Record<string, string>): Request {
  const body = new URLSearchParams(campos);
  return new Request('https://os.franciscoabad.com/api/oauth/authorize', {
    method: 'POST',
    headers: { cookie: 'os_auth=sess', 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

test('POST approve emite un code y redirige al redirect_uri con code y state', async () => {
  await conSesion(async (db) => {
    const res = await POST({ request: formReq({
      client_id: 'mcp_gemini', redirect_uri: REDIRECT, scope: 'read write', state: 'xyz-state',
      code_challenge: CHALLENGE, code_challenge_method: 'S256', response_type: 'code', decision: 'approve',
    }) });
    assert.equal(res.status, 302);
    const loc = new URL(res.headers.get('location') ?? '');
    assert.equal(`${loc.origin}${loc.pathname}`, REDIRECT);
    assert.ok(loc.searchParams.get('code'), 'debe traer code');
    assert.equal(loc.searchParams.get('state'), 'xyz-state');
    // Se guardo exactamente un codigo (hasheado).
    assert.equal(db[TABLA_CODES].length, 1);
    assert.match(String(db[TABLA_CODES][0]!.code_hash), /^[0-9a-f]{64}$/);
    assert.equal(db[TABLA_CODES][0]!.actor, 'Gemini');
  });
});

test('POST deny redirige con error access_denied', async () => {
  await conSesion(async () => {
    const res = await POST({ request: formReq({
      client_id: 'mcp_gemini', redirect_uri: REDIRECT, state: 's', response_type: 'code',
      code_challenge: CHALLENGE, code_challenge_method: 'S256', decision: 'deny',
    }) });
    assert.equal(res.status, 302);
    const loc = new URL(res.headers.get('location') ?? '');
    assert.equal(loc.searchParams.get('error'), 'access_denied');
  });
});
