import assert from 'node:assert/strict';
import test from 'node:test';
import { ErrorAgenda, defaultRango, etiquetasAgenda, normalizarFechaAgenda } from './agenda.handlers.ts';

test('agenda usa Guayaquil y entrega dos semanas completas desde sabado', () => {
  const range = defaultRango(null, null, new Date('2026-08-29T06:42:00Z'));
  assert.deepEqual(range, { desde: '2026-08-29', hasta: '2026-09-11' });
});

test('agenda normaliza datetime-local con offset de Ecuador', () => {
  assert.equal(normalizarFechaAgenda('2026-08-29T09:30'), '2026-08-29T09:30:00-05:00');
  assert.equal(normalizarFechaAgenda('2026-08-29T09:30:00+00:00'), '2026-08-29T09:30:00+00:00');
  assert.throws(() => normalizarFechaAgenda('2026-08-29'), ErrorAgenda);
});

test('agenda limpia, limita y deduplica etiquetas', () => {
  assert.deepEqual(etiquetasAgenda(' Ventas, foco,ventas, , muy-larga-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx '), ['ventas', 'foco']);
  assert.deepEqual(etiquetasAgenda(['Casa', 'casa', 'Health']), ['casa', 'health']);
});
