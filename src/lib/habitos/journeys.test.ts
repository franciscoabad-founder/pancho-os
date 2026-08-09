import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarEtapa } from './journeys.ts';

const HOY = '2026-07-19'; // domingo

test('evaluarEtapa: ventana móvil exacta, check justo en el borde cuenta', () => {
  const criterio = { tipo: 'checks' as const, habito_id: 'h1', meta: 1, ventana_dias: 7 };
  // ventana = [hoy-6, hoy] = [2026-07-13, 2026-07-19]
  const checks = [{ habito_id: 'h1', fecha: '2026-07-13' }];
  const r = evaluarEtapa(criterio, checks, HOY, 'h1');
  assert.equal(r.hechos, 1);
  assert.equal(r.cumplida, true);
});

test('evaluarEtapa: check un día antes del borde de la ventana NO cuenta', () => {
  const criterio = { tipo: 'checks' as const, habito_id: 'h1', meta: 1, ventana_dias: 7 };
  const checks = [{ habito_id: 'h1', fecha: '2026-07-12' }]; // un día antes del borde
  const r = evaluarEtapa(criterio, checks, HOY, 'h1');
  assert.equal(r.hechos, 0);
  assert.equal(r.cumplida, false);
});

test('evaluarEtapa: cuenta solo checks del hábito indicado', () => {
  const criterio = { tipo: 'checks' as const, habito_id: 'h1', meta: 2, ventana_dias: 7 };
  const checks = [
    { habito_id: 'h1', fecha: '2026-07-15' },
    { habito_id: 'h2', fecha: '2026-07-16' }, // otro hábito, no cuenta
    { habito_id: 'h1', fecha: '2026-07-17' },
  ];
  const r = evaluarEtapa(criterio, checks, HOY, 'h1');
  assert.equal(r.hechos, 2);
  assert.equal(r.cumplida, true);
});

test('evaluarEtapa: no cumplida si faltan checks, progreso proporcional', () => {
  const criterio = { tipo: 'checks' as const, habito_id: 'h1', meta: 4, ventana_dias: 7 };
  const checks = [
    { habito_id: 'h1', fecha: '2026-07-15' },
    { habito_id: 'h1', fecha: '2026-07-17' },
  ];
  const r = evaluarEtapa(criterio, checks, HOY, 'h1');
  assert.equal(r.hechos, 2);
  assert.equal(r.cumplida, false);
  assert.equal(r.progreso, 0.5);
});

test('evaluarEtapa: progreso se topa en 1 aunque se superen los hechos requeridos', () => {
  const criterio = { tipo: 'checks' as const, habito_id: 'h1', meta: 2, ventana_dias: 7 };
  const checks = [
    { habito_id: 'h1', fecha: '2026-07-15' },
    { habito_id: 'h1', fecha: '2026-07-16' },
    { habito_id: 'h1', fecha: '2026-07-17' },
  ];
  const r = evaluarEtapa(criterio, checks, HOY, 'h1');
  assert.equal(r.hechos, 3);
  assert.equal(r.progreso, 1);
  assert.equal(r.cumplida, true);
});

test('evaluarEtapa: checks fuera de la ventana (muy antiguos) no cuentan', () => {
  const criterio = { tipo: 'checks' as const, habito_id: 'h1', meta: 1, ventana_dias: 3 };
  const checks = [{ habito_id: 'h1', fecha: '2026-06-01' }];
  const r = evaluarEtapa(criterio, checks, HOY, 'h1');
  assert.equal(r.hechos, 0);
  assert.equal(r.cumplida, false);
});
