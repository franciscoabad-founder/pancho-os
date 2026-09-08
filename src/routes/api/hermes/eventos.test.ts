// Contrato del webhook POST /api/hermes/eventos (F4). Se llama al handler de
// la server route directamente (Route.options.server.handlers), con el
// registro de eventos doblado por el seam de Supabase.
//
// Lo que se cubre es lo que hace seguro al endpoint, que es lo unico del OS
// que NO pasa por isOsAuthorized: secreto correcto guarda, secreto incorrecto
// o ausente dan 401 (sin filtrar el largo del real), y un cuerpo gigante se
// corta con 413 ANTES de parsear el JSON.

import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Route, MAX_CUERPO_BYTES } from './eventos.ts';
import { setClienteSupabaseEventos } from '../../../server/hermesEventos.handlers.ts';

type Fila = Record<string, unknown>;
const handlers = (Route as unknown as {
  options: { server: { handlers: Record<string, (ctx: { request: Request }) => Promise<Response>> } };
}).options.server.handlers;

const SECRETO = 'secreto-de-hermes-en-produccion';
let guardados: Fila[];

/** Doble minimo: solo hace falta el insert en hermes_eventos y un select vacio. */
function crearCliente(): SupabaseClient {
  function builder(nombre: string) {
    let insertRows: Fila[] = [];
    let modo: 'select' | 'insert' = 'select';
    const self = {
      select() { return self; },
      insert(rows: Fila | Fila[]) { modo = 'insert'; insertRows = Array.isArray(rows) ? rows : [rows]; return self; },
      update() { return self; },
      eq() { return self; },
      in() { return self; },
      order() { return self; },
      limit() { return self; },
      single() {
        if (modo === 'insert' && nombre === 'hermes_eventos') {
          const fila = { id: 'evt-1', leido: false, created_at: new Date().toISOString(), ...insertRows[0] };
          guardados.push(fila);
          return Promise.resolve({ data: fila, error: null });
        }
        return Promise.resolve({ data: null, error: { message: 'no rows' } });
      },
      then(resolve: (v: unknown) => unknown) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return self;
  }
  return { from: (n: string) => builder(n) } as unknown as SupabaseClient;
}

function pedir(cuerpo: string, secreto?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secreto !== undefined) headers['x-hermes-secret'] = secreto;
  return new Request('https://os.franciscoabad.com/api/hermes/eventos', { method: 'POST', headers, body: cuerpo });
}

beforeEach(() => {
  guardados = [];
  process.env.HERMES_WEBHOOK_SECRET = SECRETO;
  setClienteSupabaseEventos(() => crearCliente());
});

test('con el secreto correcto el evento se guarda', async () => {
  const res = await handlers.POST({ request: pedir(JSON.stringify({ tipo: 'job.completed', titulo: 'Listo' }), SECRETO) });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.evento.tipo, 'job.completed');
  assert.equal(guardados.length, 1);
});

test('secreto incorrecto, vacio o de otro largo dan 401 y no guardan nada', async () => {
  for (const malo of ['otro-secreto', '', `${SECRETO}x`, SECRETO.slice(0, -1)]) {
    const res = await handlers.POST({ request: pedir(JSON.stringify({ tipo: 'x' }), malo) });
    assert.equal(res.status, 401, `deberia rechazar: ${JSON.stringify(malo)}`);
  }
  assert.equal(guardados.length, 0);
});

test('sin el header x-hermes-secret da 401', async () => {
  const res = await handlers.POST({ request: pedir(JSON.stringify({ tipo: 'x' })) });
  assert.equal(res.status, 401);
  assert.equal(guardados.length, 0);
});

test('sin HERMES_WEBHOOK_SECRET configurado el webhook se cierra, no se abre', async () => {
  delete process.env.HERMES_WEBHOOK_SECRET;
  const res = await handlers.POST({ request: pedir(JSON.stringify({ tipo: 'x' }), '') });
  assert.equal(res.status, 401);
  assert.equal(guardados.length, 0);
});

test('un cuerpo mayor a 64 KB se corta con 413', async () => {
  const gigante = JSON.stringify({ tipo: 'agent.message', content: 'a'.repeat(MAX_CUERPO_BYTES + 100) });
  const res = await handlers.POST({ request: pedir(gigante, SECRETO) });
  assert.equal(res.status, 413);
  assert.equal(guardados.length, 0);
});

test('JSON invalido da 400, no 500', async () => {
  const res = await handlers.POST({ request: pedir('{no soy json', SECRETO) });
  assert.equal(res.status, 400);
});

test('un evento sin tipo da 400', async () => {
  const res = await handlers.POST({ request: pedir(JSON.stringify({ titulo: 'sin tipo' }), SECRETO) });
  assert.equal(res.status, 400);
  assert.equal(guardados.length, 0);
});

test('GET y PATCH siguen exigiendo la sesion del OS', async () => {
  const url = 'https://os.franciscoabad.com/api/hermes/eventos?leido=false';
  assert.equal((await handlers.GET({ request: new Request(url) })).status, 401);
  assert.equal(
    (await handlers.PATCH({
      request: new Request(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"id":"evt-1"}' }),
    })).status,
    401,
  );
});
