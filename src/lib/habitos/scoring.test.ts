import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  multiplicadorDificultad, factorValor, nuevoValor,
  recompensaCheck, penalizacionFallo,
} from './scoring.ts';

test('multiplicadorDificultad: valores esperados', () => {
  assert.equal(multiplicadorDificultad('trivial'), 0.5);
  assert.equal(multiplicadorDificultad('facil'), 1);
  assert.equal(multiplicadorDificultad('media'), 1.5);
  assert.equal(multiplicadorDificultad('dificil'), 2);
});

test('factorValor: valor 0 => factor 1', () => {
  assert.equal(factorValor(0), 1);
});

test('factorValor: clamp superior en 2.5 (valor muy negativo)', () => {
  assert.equal(factorValor(-100), 2.5);
  assert.equal(factorValor(-1000), 2.5);
});

test('factorValor: clamp inferior en 0.4 (valor muy alto)', () => {
  assert.equal(factorValor(100), 0.4);
  assert.equal(factorValor(1000), 0.4);
});

test('factorValor: decrece a medida que sube el valor', () => {
  assert.ok(factorValor(10) < factorValor(0));
  assert.ok(factorValor(20) < factorValor(10));
});

test('nuevoValor: signo mas suma el multiplicador de dificultad', () => {
  assert.equal(nuevoValor(0, 'mas', 'facil'), 1);
  assert.equal(nuevoValor(0, 'mas', 'dificil'), 2);
  assert.equal(nuevoValor(5, 'mas', 'trivial'), 5.5);
});

test('nuevoValor: signo menos resta el multiplicador de dificultad', () => {
  assert.equal(nuevoValor(0, 'menos', 'facil'), -1);
  assert.equal(nuevoValor(0, 'menos', 'dificil'), -2);
  assert.equal(nuevoValor(5, 'menos', 'trivial'), 4.5);
});

test('recompensaCheck: mínimo 1 XP y 1 oro con dificultad trivial y valor alto (factor mínimo)', () => {
  const r = recompensaCheck(100, 'trivial');
  assert.ok(r.xp >= 1);
  assert.ok(r.oro >= 1);
  assert.equal(r.oro, 1); // 5 * 0.5 * 0.4 = 1: toca el piso exacto
});

test('recompensaCheck: dificultad dificil con valor bajo da más recompensa', () => {
  const facil = recompensaCheck(0, 'facil');
  const dificil = recompensaCheck(0, 'dificil');
  assert.ok(dificil.xp > facil.xp);
  assert.ok(dificil.oro > facil.oro);
});

test('recompensaCheck: valor muy negativo (bonus de recuperación) sube la recompensa', () => {
  const normal = recompensaCheck(0, 'media');
  const recuperando = recompensaCheck(-100, 'media');
  assert.ok(recuperando.xp > normal.xp);
  assert.ok(recuperando.oro > normal.oro);
});

test('penalizacionFallo: empuja el valor hacia negativo, igual que nuevoValor con signo menos', () => {
  assert.equal(penalizacionFallo(10, 'media'), nuevoValor(10, 'menos', 'media'));
  assert.equal(penalizacionFallo(0, 'dificil'), -2);
});
