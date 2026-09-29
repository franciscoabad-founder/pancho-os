import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { construirRutaSesiones, listarSesionesHermes, setFetcherSesiones } from './hermesSesiones.handlers.ts';

afterEach(() => setFetcherSesiones(null));

test('construirRutaSesiones: por defecto trae todos los perfiles, 200 recientes', () => {
  const ruta = construirRutaSesiones({});
  assert.ok(ruta.startsWith('/hermes-api/api/profiles/sessions?'));
  const q = new URL(`http://x${ruta}`).searchParams;
  assert.equal(q.get('limit'), '200');
  assert.equal(q.get('offset'), '0');
  assert.equal(q.get('order'), 'recent');
  assert.equal(q.get('archived'), 'exclude');
  assert.equal(q.has('profile'), false);
  assert.equal(q.has('sources'), false);
});

test('construirRutaSesiones: canal se traduce a sources y el limite se acota a 500', () => {
  const q = new URL(`http://x${construirRutaSesiones({ canal: 'oneshot', perfil: 'arazza', limite: 9999, desplazamiento: -5 })}`).searchParams;
  assert.equal(q.get('sources'), 'oneshot,tool');
  assert.equal(q.get('profile'), 'arazza');
  assert.equal(q.get('limit'), '500');
  assert.equal(q.get('offset'), '0');
});

test('construirRutaSesiones: un perfil con caracteres raros se ignora (no se inyecta en la URL)', () => {
  const q = new URL(`http://x${construirRutaSesiones({ perfil: 'x&archived=include' })}`).searchParams;
  assert.equal(q.has('profile'), false);
  assert.equal(q.get('archived'), 'exclude');
});

test('listarSesionesHermes: normaliza filas, descarta las sin id y pasa totales y errores', async () => {
  let visto = '';
  setFetcherSesiones(async (url, init) => {
    visto = String(url);
    assert.equal(init?.method, 'GET');
    return new Response(
      JSON.stringify({
        sessions: [
          { id: 'a', source: 'telegram', profile: 'default', chat_type: 'group', chat_id: '-100', display_name: 'Pancho HQ', thread_id: '1279', last_active: 5 },
          { source: 'cron' },
        ],
        total: 1193,
        profile_totals: { default: 594, arazza: 529 },
        errors: [{ profile: 'nerio', error: 'locked' }],
      }),
      { status: 200 },
    );
  });
  const r = await listarSesionesHermes({ canal: 'telegram' });
  assert.match(visto, /sources=telegram/);
  assert.equal(r.sesiones.length, 1);
  assert.equal(r.sesiones[0].telegram?.topic, '1279');
  assert.equal(r.total, 1193);
  assert.deepEqual(r.totalPorPerfil, { default: 594, arazza: 529 });
  assert.deepEqual(r.errores, [{ profile: 'nerio', error: 'locked' }]);
});

test('listarSesionesHermes: si hermes-ui falla el error es explicito, no una lista vacia', async () => {
  setFetcherSesiones(async () => new Response('x', { status: 503 }));
  await assert.rejects(listarSesionesHermes(), /HTTP 503/);
  setFetcherSesiones(async () => {
    throw new Error('ECONNREFUSED');
  });
  await assert.rejects(listarSesionesHermes(), /hermes-ui no responde: ECONNREFUSED/);
  setFetcherSesiones(async () => new Response(JSON.stringify({ nada: true }), { status: 200 }));
  await assert.rejects(listarSesionesHermes(), /sin sesiones/);
});
