import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparar } from './deriva.ts';

test('comparar: mapas identicos => todo estable, nada agregado ni quitado', () => {
  const anterior = [{ id: 'a1', texto: 'Diseñar sistemas', cuadrante: 'bueno' }];
  const actual = [{ id: 'a2', texto: 'Diseñar sistemas', cuadrante: 'bueno' }];
  const d = comparar(anterior, actual);
  assert.equal(d.agregados.length, 0);
  assert.equal(d.quitados.length, 0);
  assert.equal(d.estables.length, 1);
});

test('comparar: item nuevo en actual => agregado', () => {
  const d = comparar([], [{ id: 'a1', texto: 'Mentorear', cuadrante: 'mundo' }]);
  assert.equal(d.agregados.length, 1);
  assert.equal(d.quitados.length, 0);
});

test('comparar: item que ya no esta en actual => quitado', () => {
  const d = comparar([{ id: 'a1', texto: 'Mentorear', cuadrante: 'mundo' }], []);
  assert.equal(d.agregados.length, 0);
  assert.equal(d.quitados.length, 1);
});

test('comparar: mismo texto pero distinto cuadrante NO es estable', () => {
  const anterior = [{ id: 'a1', texto: 'Educar', cuadrante: 'mundo' }];
  const actual = [{ id: 'a2', texto: 'Educar', cuadrante: 'pagan' }];
  const d = comparar(anterior, actual);
  assert.equal(d.estables.length, 0);
  assert.equal(d.agregados.length, 1);
  assert.equal(d.quitados.length, 1);
});

test('comparar: normaliza espacios y mayusculas al comparar texto', () => {
  const anterior = [{ id: 'a1', texto: '  Diseñar Sistemas  ', cuadrante: 'bueno' }];
  const actual = [{ id: 'a2', texto: 'diseñar sistemas', cuadrante: 'bueno' }];
  const d = comparar(anterior, actual);
  assert.equal(d.estables.length, 1);
});
