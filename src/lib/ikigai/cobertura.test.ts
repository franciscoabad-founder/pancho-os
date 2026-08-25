import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cobertura } from './cobertura.ts';

test('cobertura: sin zonas, los 4 cuadrantes son hueco', () => {
  const c = cobertura([]);
  assert.deepEqual(c.huecos.sort(), ['amas', 'bueno', 'mundo', 'pagan']);
});

test('cobertura: un cuadrante sin ninguna zona queda como hueco', () => {
  const c = cobertura([{ cuadrantes: ['amas', 'bueno'] }]);
  assert.deepEqual(c.huecos.sort(), ['mundo', 'pagan']);
});

test('cobertura: cuenta solapes correctamente', () => {
  const c = cobertura([
    { cuadrantes: ['amas', 'bueno'] },
    { cuadrantes: ['amas', 'mundo'] },
  ]);
  assert.equal(c.porCuadrante.amas, 2);
  assert.equal(c.porCuadrante.bueno, 1);
  assert.equal(c.huecos.length, 1); // pagan
  assert.deepEqual(c.huecos, ['pagan']);
});

test('cobertura: los 4 cubiertos => sin huecos', () => {
  const c = cobertura([{ cuadrantes: ['amas', 'bueno', 'pagan', 'mundo'] }]);
  assert.deepEqual(c.huecos, []);
});
