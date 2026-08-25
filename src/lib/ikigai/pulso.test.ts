import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tendencia } from './pulso.ts';

test('tendencia: sin pulsos => sin_datos', () => {
  assert.equal(tendencia([]), 'sin_datos');
});

test('tendencia: 1 solo pulso => sin_datos (no hay con que comparar)', () => {
  assert.equal(tendencia([{ periodo: '2026-08', nivel: 3 }]), 'sin_datos');
});

test('tendencia: sube claramente', () => {
  const pulsos = [
    { periodo: '2026-06', nivel: 2 },
    { periodo: '2026-07', nivel: 2 },
    { periodo: '2026-08', nivel: 5 },
    { periodo: '2026-09', nivel: 5 },
  ];
  assert.equal(tendencia(pulsos), 'sube');
});

test('tendencia: baja claramente', () => {
  const pulsos = [
    { periodo: '2026-06', nivel: 5 },
    { periodo: '2026-07', nivel: 5 },
    { periodo: '2026-08', nivel: 2 },
    { periodo: '2026-09', nivel: 2 },
  ];
  assert.equal(tendencia(pulsos), 'baja');
});

test('tendencia: variacion chica se considera plana', () => {
  const pulsos = [
    { periodo: '2026-06', nivel: 3 },
    { periodo: '2026-07', nivel: 3 },
  ];
  assert.equal(tendencia(pulsos), 'plano');
});

test('tendencia: respeta la ventana, ignora pulsos viejos', () => {
  const pulsos = [
    { periodo: '2026-01', nivel: 5 }, // fuera de ventana de 2
    { periodo: '2026-02', nivel: 5 },
    { periodo: '2026-08', nivel: 1 },
    { periodo: '2026-09', nivel: 1 },
  ];
  // ventana=2 solo mira los ultimos 2 (08 y 09), ambos nivel 1 => plano, no baja
  assert.equal(tendencia(pulsos, 2), 'plano');
});
