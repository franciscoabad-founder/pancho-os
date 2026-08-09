import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreEma, diasProgramados } from './ema.ts';

test('scoreEma: días vacíos => 0', () => {
  assert.equal(scoreEma([]), 0);
});

test('scoreEma: todos hechos converge cerca de 1', () => {
  const dias = Array.from({ length: 60 }, (_, i) => ({ fecha: `d${i}`, hecho: true }));
  const s = scoreEma(dias);
  assert.ok(s > 0.9, `score ${s} debería estar cerca de 1`);
  assert.ok(s < 1, `score ${s} nunca debe llegar exactamente a 1`);
});

test('scoreEma: 60 hechos + 1 fallo apenas baja (>0.9)', () => {
  const hechos = Array.from({ length: 60 }, (_, i) => ({ fecha: `d${i}`, hecho: true }));
  const conFallo = [...hechos, { fecha: 'd60', hecho: false }];
  const s = scoreEma(conFallo);
  assert.ok(s > 0.9, `score ${s} debería seguir por encima de 0.9 tras un solo fallo`);
});

test('scoreEma: todos fallados => 0', () => {
  const dias = Array.from({ length: 20 }, (_, i) => ({ fecha: `d${i}`, hecho: false }));
  assert.equal(scoreEma(dias), 0);
});

test('scoreEma: un fallo reciente pesa más que uno antiguo', () => {
  const base = Array.from({ length: 20 }, (_, i) => ({ fecha: `d${i}`, hecho: true }));
  const falloAntiguo = base.map((d, i) => (i === 0 ? { ...d, hecho: false } : d));
  const falloReciente = base.map((d, i) => (i === base.length - 1 ? { ...d, hecho: false } : d));
  assert.ok(scoreEma(falloReciente) < scoreEma(falloAntiguo));
});

test('diasProgramados: solo incluye los días que caen en diasSemana', () => {
  // 2026-07-13 lunes .. 2026-07-19 domingo; diasSemana L-M-V (1,3,5)
  const dias = diasProgramados('2026-07-13', '2026-07-19', [1, 3, 5], new Set());
  const fechas = dias.map((d) => d.fecha);
  assert.deepEqual(fechas, ['2026-07-13', '2026-07-15', '2026-07-17']);
});

test('diasProgramados: marca hecho según fechasHechas', () => {
  const dias = diasProgramados('2026-07-13', '2026-07-17', [1, 3, 5], new Set(['2026-07-15']));
  const porFecha = Object.fromEntries(dias.map((d) => [d.fecha, d.hecho]));
  assert.equal(porFecha['2026-07-13'], false);
  assert.equal(porFecha['2026-07-15'], true);
  assert.equal(porFecha['2026-07-17'], false);
});
