import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recompensaPorEvento } from './recompensas.ts';

test('tarea_hecha: tabla exacta de prioridad -> xp/oro (oro = mitad redondeada)', () => {
  assert.deepEqual(recompensaPorEvento('tarea_hecha', { prioridad: 'low' }), { xp: 5, oro: 3 });
  assert.deepEqual(recompensaPorEvento('tarea_hecha', { prioridad: 'medium' }), { xp: 10, oro: 5 });
  assert.deepEqual(recompensaPorEvento('tarea_hecha', { prioridad: 'high' }), { xp: 15, oro: 8 });
  assert.deepEqual(recompensaPorEvento('tarea_hecha', { prioridad: 'critical' }), { xp: 25, oro: 13 });
});

test('tarea_hecha: sin prioridad explicita usa medium por defecto', () => {
  assert.deepEqual(recompensaPorEvento('tarea_hecha'), { xp: 10, oro: 5 });
});

test('pendiente_hecho: 8 xp fijo', () => {
  assert.deepEqual(recompensaPorEvento('pendiente_hecho'), { xp: 8, oro: 4 });
});

test('sesion_gym: 30 xp fijo', () => {
  assert.deepEqual(recompensaPorEvento('sesion_gym'), { xp: 30, oro: 15 });
});

test('ayuno_fin: 20 xp fijo', () => {
  assert.deepEqual(recompensaPorEvento('ayuno_fin'), { xp: 20, oro: 10 });
});

test('comida_log: 5 xp fijo', () => {
  assert.deepEqual(recompensaPorEvento('comida_log'), { xp: 5, oro: 3 });
});

test('registro_cuerpo: 5 xp fijo', () => {
  assert.deepEqual(recompensaPorEvento('registro_cuerpo'), { xp: 5, oro: 3 });
});

test('dia_perfecto: 25 xp fijo', () => {
  assert.deepEqual(recompensaPorEvento('dia_perfecto'), { xp: 25, oro: 13 });
});

test('habito_check y diaria_check delegan al scoring de habitos (mismo resultado)', () => {
  const habito = recompensaPorEvento('habito_check', { dificultad: 'media', valor: 0 });
  const diaria = recompensaPorEvento('diaria_check', { dificultad: 'media', valor: 0 });
  assert.deepEqual(habito, diaria);
  assert.ok(habito.xp > 0 && habito.oro > 0);
});

test('habito_check: dificultad default facil, valor default 0 si no vienen en meta', () => {
  const r = recompensaPorEvento('habito_check');
  assert.ok(r.xp > 0);
});

for (const tipo of ['diaria_fallo', 'quest_ganada', 'quest_perdida', 'compra_recompensa', 'loot', 'muerte', 'ajuste'] as const) {
  test(`${tipo}: no recompensable, monto viene dado externamente ({0,0})`, () => {
    assert.deepEqual(recompensaPorEvento(tipo), { xp: 0, oro: 0 });
  });
}
