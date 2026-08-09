import { test } from 'node:test';
import assert from 'node:assert/strict';
import { danioPorFallo, aplicarMuerte, freshStart } from './hp.ts';

test('danioPorFallo: siempre en rango 2..6', () => {
  const dificultades = ['trivial', 'facil', 'media', 'dificil'] as const;
  const valores = [-100, -10, 0, 5, 10, 100];
  for (const d of dificultades) {
    for (const v of valores) {
      const danio = danioPorFallo(d, v);
      assert.ok(danio >= 2 && danio <= 6, `danio ${danio} fuera de rango para ${d}/${v}`);
    }
  }
});

test('danioPorFallo: monotonico con el valor (mas valor = mas o igual dano)', () => {
  const bajo = danioPorFallo('media', 0);
  const alto = danioPorFallo('media', 10);
  assert.ok(alto >= bajo);
});

test('danioPorFallo: dificultad mayor sube el dano', () => {
  const trivial = danioPorFallo('trivial', 0);
  const dificil = danioPorFallo('dificil', 0);
  assert.ok(dificil >= trivial);
});

test('danioPorFallo: valor negativo (recuperando) no baja del piso 2', () => {
  assert.equal(danioPorFallo('trivial', -50), 2);
});

test('aplicarMuerte: pierde 50% del oro redondeado y restaura HP al maximo', () => {
  assert.deepEqual(aplicarMuerte(100, 50), { oroPerdido: 50, hpNuevo: 50 });
  assert.deepEqual(aplicarMuerte(0, 50), { oroPerdido: 0, hpNuevo: 50 });
  assert.deepEqual(aplicarMuerte(7, 50), { oroPerdido: 4, hpNuevo: 50 }); // 3.5 -> 4
});

test('aplicarMuerte: oro invalido o negativo no revienta (trata como 0)', () => {
  assert.deepEqual(aplicarMuerte(-10, 50), { oroPerdido: 0, hpNuevo: 50 });
});

test('freshStart: devuelve el hp_max recibido', () => {
  assert.equal(freshStart(50), 50);
  assert.equal(freshStart(100), 100);
});
