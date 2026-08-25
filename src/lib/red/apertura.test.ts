import { test } from 'node:test';
import assert from 'node:assert/strict';
import { densidad, banda, distanciaAlIdeal } from './apertura.ts';

test('densidad: 0 personas => 0, sin division por cero', () => {
  assert.equal(densidad(0, 0), 0);
});

test('densidad: 1 persona => 0 (no hay pares posibles)', () => {
  assert.equal(densidad(1, 5), 0);
});

test('densidad: 4 personas totalmente conectadas => 1', () => {
  // C(4,2) = 6 pares posibles
  assert.equal(densidad(4, 6), 1);
});

test('densidad: 4 personas sin ninguna conexion => 0', () => {
  assert.equal(densidad(4, 0), 0);
});

test('banda: las 6 bandas en sus fronteras', () => {
  assert.equal(banda(0), 'muy-abierta');
  assert.equal(banda(0.15), 'muy-abierta');
  assert.equal(banda(0.2), 'abierta');
  assert.equal(banda(0.5), 'ideal');
  assert.equal(banda(0.7), 'algo-cerrada');
  assert.equal(banda(0.9), 'cerrada');
  assert.equal(banda(1), 'muy-cerrada');
});

test('banda: el centro exacto (0.5) es ideal, no un extremo', () => {
  assert.equal(banda(0.5), 'ideal');
});

test('distanciaAlIdeal: negativo cuando muy abierta, positivo cuando muy cerrada', () => {
  assert.ok(distanciaAlIdeal(0.1) < 0);
  assert.ok(distanciaAlIdeal(0.9) > 0);
  assert.equal(distanciaAlIdeal(0.5), 0);
});
