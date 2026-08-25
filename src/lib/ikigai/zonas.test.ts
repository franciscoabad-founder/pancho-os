import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clasificar } from './zonas.ts';

test('clasificar: 0 cuadrantes => vacio', () => {
  assert.equal(clasificar([]), 'vacio');
});

test('clasificar: 4 cuadrantes => ikigai (el centro)', () => {
  assert.equal(clasificar(['amas', 'bueno', 'pagan', 'mundo']), 'ikigai');
});

test('clasificar: amas+bueno => pasion', () => {
  assert.equal(clasificar(['amas', 'bueno']), 'pasion');
});

test('clasificar: amas+mundo => mision', () => {
  assert.equal(clasificar(['mundo', 'amas']), 'mision');
});

test('clasificar: bueno+pagan => profesion', () => {
  assert.equal(clasificar(['pagan', 'bueno']), 'profesion');
});

test('clasificar: mundo+pagan => vocacion', () => {
  assert.equal(clasificar(['mundo', 'pagan']), 'vocacion');
});

test('clasificar: pareja no canonica (amas+pagan) => parcial', () => {
  assert.equal(clasificar(['amas', 'pagan']), 'parcial');
});

test('clasificar: 1 cuadrante => parcial', () => {
  assert.equal(clasificar(['amas']), 'parcial');
});

test('clasificar: 3 cuadrantes => parcial', () => {
  assert.equal(clasificar(['amas', 'bueno', 'pagan']), 'parcial');
});

test('clasificar: duplicados se deduplican antes de clasificar', () => {
  assert.equal(clasificar(['amas', 'amas', 'bueno']), 'pasion');
});
