import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entropiaAreas, distribucionAreas } from './diversidad.ts';

test('entropiaAreas: sin personas => 0', () => {
  assert.equal(entropiaAreas([]), 0);
});

test('entropiaAreas: un area unica => 0 (nula diversidad)', () => {
  const personas = [{ area: 'trabajo' }, { area: 'trabajo' }, { area: 'trabajo' }];
  assert.equal(entropiaAreas(personas), 0);
});

test('entropiaAreas: distribucion perfectamente uniforme => 1', () => {
  const personas = [{ area: 'a' }, { area: 'b' }, { area: 'c' }, { area: 'd' }];
  assert.equal(entropiaAreas(personas), 1);
});

test('entropiaAreas: distribucion desigual queda entre 0 y 1', () => {
  const personas = [{ area: 'a' }, { area: 'a' }, { area: 'a' }, { area: 'b' }];
  const e = entropiaAreas(personas);
  assert.ok(e > 0 && e < 1);
});

test('distribucionAreas: porcentajes suman ~100 y estan ordenados desc', () => {
  const personas = [{ area: 'trabajo' }, { area: 'trabajo' }, { area: 'familia' }];
  const dist = distribucionAreas(personas);
  assert.equal(dist[0].area, 'trabajo');
  assert.equal(dist[0].pct, 67);
  assert.equal(dist[1].pct, 33);
});
