import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duracionHoras, faseActual, formatearDuracion, FASES_AYUNO } from './ayuno.ts';

test('duracionHoras: fin explícito', () => {
  const h = duracionHoras('2026-07-15T08:00:00Z', '2026-07-15T20:00:00Z');
  assert.equal(h, 12);
});

test('duracionHoras: sin fin usa ahoraMs', () => {
  const inicio = '2026-07-15T08:00:00Z';
  const ahora = new Date('2026-07-15T24:00:00Z').getTime();
  assert.equal(duracionHoras(inicio, null, ahora), 16);
});

test('duracionHoras: fin antes de inicio => 0', () => {
  assert.equal(duracionHoras('2026-07-15T20:00:00Z', '2026-07-15T08:00:00Z'), 0);
});

test('duracionHoras: fecha inválida => 0', () => {
  assert.equal(duracionHoras('no-fecha', null, 1000), 0);
});

test('faseActual: límites de cada fase', () => {
  assert.equal(faseActual(0).key, 'digestion');
  assert.equal(faseActual(3.9).key, 'digestion');
  assert.equal(faseActual(4).key, 'transicion');
  assert.equal(faseActual(11.9).key, 'transicion');
  assert.equal(faseActual(12).key, 'quema');
  assert.equal(faseActual(16).key, 'cetosis');
  assert.equal(faseActual(23.9).key, 'cetosis');
  assert.equal(faseActual(24).key, 'autofagia');
  assert.equal(faseActual(48).key, 'autofagia');
});

test('faseActual: negativo o NaN => digestion', () => {
  assert.equal(faseActual(-5).key, 'digestion');
  assert.equal(faseActual(NaN).key, 'digestion');
});

test('formatearDuracion: horas y minutos', () => {
  assert.equal(formatearDuracion(16.5), '16h 30m');
  assert.equal(formatearDuracion(0), '0h 00m');
  assert.equal(formatearDuracion(1.0167), '1h 01m');
});

test('FASES_AYUNO: cobertura contigua sin huecos', () => {
  for (let i = 1; i < FASES_AYUNO.length; i++) {
    assert.equal(FASES_AYUNO[i].desde, FASES_AYUNO[i - 1].hasta);
  }
});
