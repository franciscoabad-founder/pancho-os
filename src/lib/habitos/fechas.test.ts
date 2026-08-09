import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaIso, addDias, proximaOcurrencia, timestampGuayaquil } from './fechas.ts';

test('diaIso: correcto para fechas conocidas (ISO 1=lunes)', () => {
  assert.equal(diaIso('2026-07-13'), 1); // lunes
  assert.equal(diaIso('2026-07-14'), 2); // martes
  assert.equal(diaIso('2026-07-15'), 3); // miércoles
  assert.equal(diaIso('2026-07-16'), 4); // jueves
  assert.equal(diaIso('2026-07-17'), 5); // viernes
  assert.equal(diaIso('2026-07-18'), 6); // sábado
  assert.equal(diaIso('2026-07-19'), 7); // domingo
});

test('addDias: suma y resta correctamente, incluyendo cruce de mes y año', () => {
  assert.equal(addDias('2026-07-14', 1), '2026-07-15');
  assert.equal(addDias('2026-07-14', -1), '2026-07-13');
  assert.equal(addDias('2026-01-01', -1), '2025-12-31');
  assert.equal(addDias('2026-02-28', 1), '2026-03-01'); // 2026 no es bisiesto
});

test('proximaOcurrencia: mismo día si aún no pasó la hora programada', () => {
  // 2026-07-13 (lunes) 05:00 Guayaquil, hábito L-M-V a las 07:00
  const desde = new Date('2026-07-13T10:00:00Z'); // 05:00 Guayaquil
  const r = proximaOcurrencia([1, 3, 5], '07:00', desde);
  assert.equal(r.toISOString(), '2026-07-13T12:00:00.000Z'); // 07:00 Guayaquil = 12:00 UTC
});

test('proximaOcurrencia: avanza al próximo día programado si ya pasó la hora', () => {
  // 2026-07-14 (martes, no programado) 10:00 Guayaquil, hábito L-M-V a las 07:00
  const desde = new Date('2026-07-14T15:00:00Z'); // 10:00 Guayaquil
  const r = proximaOcurrencia([1, 3, 5], '07:00', desde);
  assert.equal(r.toISOString(), '2026-07-15T12:00:00.000Z'); // miércoles 07:00 Guayaquil
});

test('proximaOcurrencia: si hoy es programado pero ya pasó la hora, salta al siguiente', () => {
  // 2026-07-13 (lunes, programado) 08:00 Guayaquil, hábito L-M-V a las 07:00 (ya pasó)
  const desde = new Date('2026-07-13T13:00:00Z'); // 08:00 Guayaquil
  const r = proximaOcurrencia([1, 3, 5], '07:00', desde);
  assert.equal(r.toISOString(), '2026-07-15T12:00:00.000Z'); // miércoles 07:00 Guayaquil
});

test('timestampGuayaquil: construye el timestamp exacto de una fecha+hora dadas', () => {
  const r = timestampGuayaquil('2026-07-14', '20:30');
  assert.equal(r.toISOString(), '2026-07-15T01:30:00.000Z'); // 20:30 Guayaquil = 01:30 UTC (+1 día)
});

test('timestampGuayaquil: NO avanza al día siguiente aunque la hora ya haya pasado', () => {
  // A diferencia de proximaOcurrencia, siempre usa la fecha dada tal cual.
  const r = timestampGuayaquil('2026-07-13', '00:01');
  assert.equal(r.toISOString(), '2026-07-13T05:01:00.000Z');
});
