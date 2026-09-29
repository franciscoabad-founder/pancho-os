import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarSkills, NOMBRE_SKILL, normalizarSkill, resumirSkills, type SkillHermes } from './skillsHermes.ts';
import { cambiarSkill, listarSkills, setFetcherSkills } from '../../server/hermesSkills.handlers.ts';

afterEach(() => setFetcherSkills(null));

const s = (nombre: string, categoria: string, activa: boolean, descripcion = ''): SkillHermes => ({
  nombre, categoria, activa, descripcion, origen: 'builtin',
});

test('normalizarSkill: descarta sin nombre y rellena categoria y origen', () => {
  assert.equal(normalizarSkill({ description: 'x' }), null);
  assert.deepEqual(normalizarSkill({ name: 'apple-notes', enabled: false }), {
    nombre: 'apple-notes', descripcion: '', categoria: 'sin categoria', activa: false, origen: 'desconocido',
  });
  assert.equal(normalizarSkill({ name: 'a', enabled: 'true' })!.activa, false);
});

test('NOMBRE_SKILL: acepta nombres normales y rechaza rutas y caracteres raros', () => {
  for (const ok of ['apple-notes', 'gstack/qa', 'skill_1.2']) assert.ok(NOMBRE_SKILL.test(ok), ok);
  for (const mal of ['', '../x', '-x', 'a b', 'a;b', 'a\nb', 'x'.repeat(200)]) assert.ok(!NOMBRE_SKILL.test(mal), mal);
});

test('filtrarSkills: por texto sin acentos, categoria y estado', () => {
  const todas = [s('cerebro', 'memoria', true, 'Búsqueda en el brain'), s('imessage', 'apple', false), s('n8n', 'memoria', false)];
  assert.deepEqual(filtrarSkills(todas, { texto: 'busqueda' }).map((x) => x.nombre), ['cerebro']);
  assert.deepEqual(filtrarSkills(todas, { categoria: 'memoria' }).map((x) => x.nombre), ['cerebro', 'n8n']);
  assert.deepEqual(filtrarSkills(todas, { estado: 'inactivas' }).map((x) => x.nombre), ['imessage', 'n8n']);
  assert.deepEqual(filtrarSkills(todas, { estado: 'activas', categoria: 'apple' }), []);
});

test('resumirSkills: totales y categorias de mas a menos', () => {
  const r = resumirSkills([s('a', 'x', true), s('b', 'y', false), s('c', 'y', true)]);
  assert.equal(r.total, 3);
  assert.equal(r.activas, 2);
  assert.deepEqual(r.categorias, [{ categoria: 'y', total: 2 }, { categoria: 'x', total: 1 }]);
});

test('listarSkills: ordena por categoria y nombre y pasa el perfil', async () => {
  let visto = '';
  setFetcherSkills(async (url) => {
    visto = String(url);
    return new Response(JSON.stringify([{ name: 'b', category: 'z' }, { name: 'a', category: 'z' }, { name: 'c', category: 'a' }, {}]), { status: 200 });
  });
  const r = await listarSkills('arazza');
  assert.match(visto, /\/hermes-api\/api\/skills\?profile=arazza$/);
  assert.deepEqual(r.map((x) => x.nombre), ['c', 'a', 'b']);
  await listarSkills('default');
  assert.doesNotMatch(visto, /profile=/);
  await listarSkills('x&y=1');
  assert.doesNotMatch(visto, /profile=/);
});

test('cambiarSkill: valida entrada antes de llamar a Hermes y manda PUT con el cuerpo exacto', async () => {
  let llamadas = 0;
  let visto: { url: string; init?: RequestInit } | null = null;
  setFetcherSkills(async (url, init) => {
    llamadas++;
    visto = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true, name: 'apple-notes', enabled: true }), { status: 200 });
  });
  await assert.rejects(cambiarSkill('../x', true), /invalido/);
  await assert.rejects(cambiarSkill('ok', 'true'), /debe ser/);
  await assert.rejects(cambiarSkill(undefined, true), /invalido/);
  assert.equal(llamadas, 0);
  const r = await cambiarSkill('apple-notes', true, 'nerio');
  assert.deepEqual(r, { nombre: 'apple-notes', activa: true });
  assert.equal(visto!.init?.method, 'PUT');
  assert.match(visto!.url, /\/api\/skills\/toggle\?profile=nerio$/);
  assert.equal(visto!.init?.body, JSON.stringify({ name: 'apple-notes', enabled: true }));
});

test('cambiarSkill: si Hermes no confirma o falla, el error es explicito', async () => {
  setFetcherSkills(async () => new Response(JSON.stringify({ ok: false }), { status: 200 }));
  await assert.rejects(cambiarSkill('a', true), /no confirmo/);
  setFetcherSkills(async () => new Response('x', { status: 500 }));
  await assert.rejects(cambiarSkill('a', true), /HTTP 500/);
});
