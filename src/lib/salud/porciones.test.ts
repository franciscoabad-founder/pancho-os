import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gramosDesdePorcion, macrosPorPorcion } from './porciones.ts';

test('gramosDesdePorcion: multiplica gramos de la porcion por la cantidad', () => {
  const taza = { nombre: 'taza', gramos: 158 };
  assert.equal(gramosDesdePorcion(taza, 2), 316);
  assert.equal(gramosDesdePorcion(taza, 1), 158);
  assert.equal(gramosDesdePorcion(taza, 0.5), 79);
});

test('gramosDesdePorcion: cantidad 0, negativa o no finita => 0', () => {
  const unidad = { nombre: 'unidad', gramos: 50 };
  assert.equal(gramosDesdePorcion(unidad, 0), 0);
  assert.equal(gramosDesdePorcion(unidad, -3), 0);
  assert.equal(gramosDesdePorcion(unidad, NaN), 0);
});

test('macrosPorPorcion: delega en calcularMacros con los gramos resueltos', () => {
  const arroz = { kcal: 130, proteina_g: 2.7, carbos_g: 28, grasa_g: 0.3, fibra_g: 0.4 };
  const taza = { nombre: 'taza', gramos: 158 };
  const gramos = gramosDesdePorcion(taza, 2);
  const m = macrosPorPorcion(arroz, gramos);
  assert.equal(gramos, 316);
  assert.equal(m.kcal, 410.8);
  assert.equal(m.proteina_g, 8.5);
});

test('macrosPorPorcion: 0 gramos => todo 0', () => {
  const pollo = { kcal: 165, proteina_g: 31, carbos_g: 0, grasa_g: 3.6 };
  const m = macrosPorPorcion(pollo, 0);
  assert.deepEqual(m, { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, fibra_g: null });
});
