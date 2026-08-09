import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epley, brzycki, estimar1RM } from './rm.ts';

test('epley: fórmula y caso conocido', () => {
  assert.equal(epley(100, 5), 116.67);
  assert.equal(epley(100, 0), 100);
  assert.equal(epley(0, 10), 0);
});

test('brzycki: fórmula y caso conocido', () => {
  assert.equal(brzycki(100, 5), 112.5);
  assert.equal(brzycki(100, 1), 100);
});

test('brzycki: fuera de rango => null', () => {
  assert.equal(brzycki(100, 12), null);
  assert.equal(brzycki(100, 20), null);
  assert.equal(brzycki(100, 0), null);
  assert.equal(brzycki(100, -1), null);
});

test('brzycki: sin peso => 0 (no null)', () => {
  assert.equal(brzycki(0, 5), 0);
});

test('estimar1RM: reps<=6 promedia epley y brzycki', () => {
  // epley(100,3) = 110, brzycki(100,3) = 105.88 -> avg 107.94
  assert.equal(estimar1RM(100, 3), 107.94);
});

test('estimar1RM: reps>6 usa solo epley', () => {
  assert.equal(estimar1RM(100, 10), epley(100, 10));
  assert.equal(estimar1RM(100, 10), 133.33);
});

test('estimar1RM: sin peso => 0', () => {
  assert.equal(estimar1RM(0, 8), 0);
});
