import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoReps, sugerirProgresion } from './progresion.ts';

test('rangoReps: fuerza, hipertrofia, resistencia', () => {
  assert.deepEqual(rangoReps('fuerza'), { min: 1, max: 5 });
  assert.deepEqual(rangoReps('hipertrofia'), { min: 6, max: 12 });
  assert.deepEqual(rangoReps('resistencia'), { min: 15, max: 25 });
});

test('sugerirProgresion: sin series de trabajo => mantener', () => {
  const r = sugerirProgresion([], 'hipertrofia');
  assert.equal(r.accion, 'mantener');
  assert.equal(r.incrementoPct, 0);
});

test('sugerirProgresion: tope 2 sesiones seguidas (accesorio) => subir_carga 2.5%', () => {
  const series = [
    { fecha: '2026-07-14', reps: 12, tipo: 'working' },
    { fecha: '2026-07-14', reps: 12, tipo: 'working' },
    { fecha: '2026-07-12', reps: 12, tipo: 'working' },
    { fecha: '2026-07-12', reps: 12, tipo: 'working' },
  ];
  const r = sugerirProgresion(series, 'hipertrofia');
  assert.equal(r.accion, 'subir_carga');
  assert.equal(r.incrementoPct, 2.5);
});

test('sugerirProgresion: tope 2 sesiones seguidas (compuesto squat/hinge) => subir_carga 5%', () => {
  const series = [
    { fecha: '2026-07-14', reps: 5, tipo: 'working' },
    { fecha: '2026-07-12', reps: 5, tipo: 'working' },
  ];
  const r = sugerirProgresion(series, 'fuerza', { patron: 'squat' });
  assert.equal(r.accion, 'subir_carga');
  assert.equal(r.incrementoPct, 5);
});

test('sugerirProgresion: solo topó 1 sesión => subir_reps (no confirmado 2 veces)', () => {
  const series = [{ fecha: '2026-07-14', reps: 12, tipo: 'working' }];
  const r = sugerirProgresion(series, 'hipertrofia');
  assert.equal(r.accion, 'subir_reps');
  assert.equal(r.incrementoPct, 0);
});

test('sugerirProgresion: aún no llega al tope => subir_reps', () => {
  const series = [
    { fecha: '2026-07-14', reps: 8, tipo: 'working' },
    { fecha: '2026-07-12', reps: 9, tipo: 'working' },
  ];
  const r = sugerirProgresion(series, 'hipertrofia');
  assert.equal(r.accion, 'subir_reps');
});

test('sugerirProgresion: warmups se ignoran', () => {
  const series = [
    { fecha: '2026-07-14', reps: 20, tipo: 'warmup' },
    { fecha: '2026-07-14', reps: 8, tipo: 'working' },
  ];
  const r = sugerirProgresion(series, 'hipertrofia');
  assert.equal(r.accion, 'subir_reps');
});
