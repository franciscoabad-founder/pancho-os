import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kgALbs, lbsAKg, formatearPeso, pesoDesdeInput, KG_POR_LB } from './unidades.ts';

test('kgALbs / lbsAKg: conversión básica', () => {
  assert.equal(KG_POR_LB, 0.45359237);
  assert.ok(Math.abs(kgALbs(1) - 2.2046226218) < 1e-6);
  assert.equal(lbsAKg(1), 0.45359237);
});

test('kgALbs / lbsAKg: round-trip (sin redondeo de presentación)', () => {
  const original = 82.3;
  const vueltaYVuelta = lbsAKg(kgALbs(original));
  assert.ok(Math.abs(vueltaYVuelta - original) < 1e-9);
});

test('formatearPeso: kg redondea a pasos de 0.25', () => {
  assert.equal(formatearPeso(60.1, 'kg'), 60);
  assert.equal(formatearPeso(60.2, 'kg'), 60.25);
  assert.equal(formatearPeso(60.4, 'kg'), 60.5);
});

test('formatearPeso: lb redondea a pasos de 0.5', () => {
  assert.equal(formatearPeso(100, 'lb'), 220.5); // 220.462... -> 220.5
  assert.equal(formatearPeso(0, 'lb'), 0);
});

test('pesoDesdeInput: kg pasa directo (canónico)', () => {
  assert.equal(pesoDesdeInput(50, 'kg'), 50);
});

test('pesoDesdeInput: lb convierte a kg canónico', () => {
  assert.equal(pesoDesdeInput(100, 'lb'), 45.36);
});

test('pesoDesdeInput: valores no numéricos no rompen', () => {
  assert.equal(pesoDesdeInput(NaN, 'kg'), 0);
});
