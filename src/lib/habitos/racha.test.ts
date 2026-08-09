import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rachaDiaria, falloAyer } from './racha.ts';

const TODOS_LOS_DIAS = [1, 2, 3, 4, 5, 6, 7];
// 2026-07-13 lunes .. 2026-07-19 domingo
const LUNES = '2026-07-13';
const MARTES = '2026-07-14';
const MIERCOLES = '2026-07-15';
const JUEVES = '2026-07-16';
const VIERNES = '2026-07-17';
const SABADO = '2026-07-18';
const DOMINGO = '2026-07-19';

test('rachaDiaria: sin fechas hechas => 0/0', () => {
  const r = rachaDiaria(new Set(), TODOS_LOS_DIAS, LUNES);
  assert.deepEqual(r, { actual: 0, mejor: 0 });
});

test('rachaDiaria: hoy sin check NO rompe la racha (aún hay tiempo)', () => {
  const hechos = new Set([LUNES, MARTES, MIERCOLES]);
  const r = rachaDiaria(hechos, TODOS_LOS_DIAS, JUEVES); // jueves pendiente
  assert.equal(r.actual, 3);
  assert.equal(r.mejor, 3);
});

test('rachaDiaria: un día programado (no hoy) sin check SÍ rompe la racha', () => {
  const hechos = new Set([LUNES, MARTES, /* miércoles falta */ JUEVES, VIERNES]);
  const r = rachaDiaria(hechos, TODOS_LOS_DIAS, VIERNES);
  assert.equal(r.actual, 2); // solo jueves+viernes
  assert.equal(r.mejor, 2);
});

test('rachaDiaria: hábito L-M-V no se rompe por sábado/domingo (días no programados)', () => {
  const diasSemana = [1, 3, 5]; // lunes, miércoles, viernes
  const hechos = new Set([LUNES, MIERCOLES, VIERNES]);
  const r = rachaDiaria(hechos, diasSemana, DOMINGO);
  assert.equal(r.actual, 3);
  assert.equal(r.mejor, 3);
});

test('rachaDiaria: mejor racha histórica se conserva aunque la actual sea menor', () => {
  // Racha larga al inicio, se rompe, y una racha corta actual.
  const hechos = new Set([LUNES, MARTES, MIERCOLES, JUEVES, /* falta viernes */ SABADO]);
  const r = rachaDiaria(hechos, TODOS_LOS_DIAS, SABADO);
  assert.equal(r.mejor, 4); // lunes-jueves
  assert.equal(r.actual, 1); // solo sábado
});

test('falloAyer: true si ayer era programado y no se hizo', () => {
  const hechos = new Set([LUNES /* falta martes */]);
  assert.equal(falloAyer(hechos, TODOS_LOS_DIAS, MIERCOLES), true);
});

test('falloAyer: false si ayer no era día programado', () => {
  const diasSemana = [1, 3, 5]; // lunes, miércoles, viernes
  const hechos = new Set<string>();
  assert.equal(falloAyer(hechos, diasSemana, DOMINGO), false); // ayer = sábado, no programado
});

test('falloAyer: false si ayer era programado y sí se hizo', () => {
  const hechos = new Set([MIERCOLES]);
  assert.equal(falloAyer(hechos, TODOS_LOS_DIAS, JUEVES), false);
});
