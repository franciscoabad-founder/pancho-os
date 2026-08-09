import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tirarLoot, probabilidadLoot } from './loot.ts';

test('probabilidadLoot: racha 0 da la probabilidad base (8%)', () => {
  assert.equal(probabilidadLoot(0), 0.08);
});

test('probabilidadLoot: sube con la racha', () => {
  assert.ok(probabilidadLoot(10) > probabilidadLoot(0));
  assert.ok(probabilidadLoot(30) > probabilidadLoot(10));
});

test('probabilidadLoot: tope en racha=30, rachas mayores no siguen subiendo', () => {
  assert.equal(probabilidadLoot(30), probabilidadLoot(100));
});

test('tirarLoot: rng=()=>0 siempre gana (determinista)', () => {
  const r = tirarLoot(() => 0, { racha: 0 });
  assert.ok(r !== null);
  assert.ok(r!.oro >= 5 && r!.oro <= 25);
  assert.equal(typeof r!.mensaje, 'string');
});

test('tirarLoot: rng=()=>0.99 nunca gana (probabilidad maxima ~20%)', () => {
  const r = tirarLoot(() => 0.99, { racha: 30 });
  assert.equal(r, null);
});

test('tirarLoot: racha alta aumenta la chance de ganar en el margen (0.1 gana con racha alta, no con racha 0)', () => {
  const sinRacha = tirarLoot(() => 0.1, { racha: 0 });
  const conRacha = tirarLoot(() => 0.1, { racha: 30 });
  assert.equal(sinRacha, null); // 0.1 >= 0.08
  assert.ok(conRacha !== null); // 0.1 < 0.2
});

test('tirarLoot: oro escala con la posicion del tiro dentro del rango de probabilidad', () => {
  const bajo = tirarLoot(() => 0, { racha: 0 });
  const alto = tirarLoot(() => 0.07, { racha: 0 });
  assert.ok(alto!.oro > bajo!.oro);
});
