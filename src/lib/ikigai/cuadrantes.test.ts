import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esCuadrante } from './cuadrantes.ts';

test('esCuadrante: true para valores validos', () => {
  assert.equal(esCuadrante('amas'), true);
  assert.equal(esCuadrante('bueno'), true);
  assert.equal(esCuadrante('pagan'), true);
  assert.equal(esCuadrante('mundo'), true);
});

test('esCuadrante: false para strings no validos', () => {
  assert.equal(esCuadrante('pasion'), false);
  assert.equal(esCuadrante('mision'), false);
  assert.equal(esCuadrante(''), false);
  assert.equal(esCuadrante('AMAS'), false);
  assert.equal(esCuadrante(' amas '), false);
});

test('esCuadrante: false para valores truthy no string', () => {
  assert.equal(esCuadrante([]), false);
  assert.equal(esCuadrante({}), false);
  assert.equal(esCuadrante(1), false);
  assert.equal(esCuadrante(true), false);
  assert.equal(esCuadrante(['amas']), false);
});

test('esCuadrante: false para valores falsy', () => {
  assert.equal(esCuadrante(undefined), false);
  assert.equal(esCuadrante(null), false);
  assert.equal(esCuadrante(0), false);
  assert.equal(esCuadrante(false), false);
});
