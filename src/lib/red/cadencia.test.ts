import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vencidos } from './cadencia.ts';

const HOY = '2026-08-25';

test('vencidos: nunca contactada => vencida de inmediato', () => {
  const personas = [{ id: '1', nombre: 'Ana', ultima_interaccion: null, frecuencia_dias: 30 }];
  const v = vencidos(personas, HOY);
  assert.equal(v.length, 1);
});

test('vencidos: dentro de la ventana => no vencida', () => {
  const personas = [{ id: '1', nombre: 'Ana', ultima_interaccion: '2026-08-20', frecuencia_dias: 30 }];
  assert.equal(vencidos(personas, HOY).length, 0);
});

test('vencidos: justo en el limite (atraso=0) => vencida', () => {
  const personas = [{ id: '1', nombre: 'Ana', ultima_interaccion: '2026-07-26', frecuencia_dias: 30 }];
  // 2026-07-26 a 2026-08-25 = 30 dias exactos
  assert.equal(vencidos(personas, HOY).length, 1);
});

test('vencidos: ordena por mayor atraso primero', () => {
  const personas = [
    { id: '1', nombre: 'Reciente', ultima_interaccion: '2026-06-01', frecuencia_dias: 7 },
    { id: '2', nombre: 'MuyAtrasada', ultima_interaccion: '2026-01-01', frecuencia_dias: 7 },
  ];
  const v = vencidos(personas, HOY);
  assert.equal(v[0].nombre, 'MuyAtrasada');
});
