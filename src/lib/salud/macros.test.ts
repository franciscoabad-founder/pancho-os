import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularMacros,
  porcionAGramos,
  sumarMacros,
  targetParaTipoDia,
  pctTarget,
  r1,
} from './macros.ts';

test('calcularMacros: proporcional a cantidad', () => {
  const pollo = { kcal: 165, proteina_g: 31, carbos_g: 0, grasa_g: 3.6, fibra_g: 0 };
  const m = calcularMacros(pollo, 200);
  assert.equal(m.kcal, 330);
  assert.equal(m.proteina_g, 62);
  assert.equal(m.carbos_g, 0);
  assert.equal(m.grasa_g, 7.2);
});

test('calcularMacros: 100g devuelve los mismos valores', () => {
  const arroz = { kcal: 130, proteina_g: 2.7, carbos_g: 28, grasa_g: 0.3, fibra_g: 0.4 };
  const m = calcularMacros(arroz, 100);
  assert.equal(m.kcal, 130);
  assert.equal(m.proteina_g, 2.7);
  assert.equal(m.fibra_g, 0.4);
});

test('calcularMacros: cantidad 0 o negativa => todo 0', () => {
  const x = { kcal: 100, proteina_g: 10, carbos_g: 10, grasa_g: 5, fibra_g: 2 };
  assert.deepEqual(calcularMacros(x, 0), { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, fibra_g: 0 });
  assert.deepEqual(calcularMacros(x, -50), { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, fibra_g: 0 });
});

test('calcularMacros: cantidad no finita => 0', () => {
  const x = { kcal: 100, proteina_g: 10, carbos_g: 10, grasa_g: 5 };
  const m = calcularMacros(x, NaN);
  assert.equal(m.kcal, 0);
  assert.equal(m.fibra_g, null); // fibra ausente => null
});

test('calcularMacros: fibra nula se mantiene nula', () => {
  const x = { kcal: 200, proteina_g: 0, carbos_g: 50, grasa_g: 0, fibra_g: null };
  const m = calcularMacros(x, 150);
  assert.equal(m.fibra_g, null);
  assert.equal(m.carbos_g, 75);
});

test('porcionAGramos: multiplica medidas', () => {
  const taza = { medida: '1 taza', gramos: 158 };
  assert.equal(porcionAGramos(taza, 2), 316);
  assert.equal(porcionAGramos(taza, 0.5), 79);
  assert.equal(porcionAGramos(taza, 0), 0);
  assert.equal(porcionAGramos(taza, -3), 0);
});

test('sumarMacros: suma y tolera nulos', () => {
  const total = sumarMacros([
    { kcal: 330, proteina_g: 62, carbos_g: 0, grasa_g: 7.2, fibra_g: 0 },
    null,
    { kcal: 130, proteina_g: 2.7, carbos_g: 28, grasa_g: 0.3, fibra_g: 0.4 },
    undefined,
  ]);
  assert.equal(total.kcal, 460);
  assert.equal(total.proteina_g, 64.7);
  assert.equal(total.carbos_g, 28);
  assert.equal(total.fibra_g, 0.4);
});

test('sumarMacros: lista vacía => ceros', () => {
  assert.deepEqual(sumarMacros([]), { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, fibra_g: 0 });
});

test('targetParaTipoDia: usa ajuste del tipo', () => {
  const base = { kcal_min: 2100, kcal_max: 2200, proteina_g: 160, carbos_g: 160, grasa_g_min: 90, grasa_g_max: 95 };
  const ajustes = {
    normal: base,
    refeed: { kcal_min: 2600, kcal_max: 2800, proteina_g: 160, carbos_g: 325, grasa_g_min: 40, grasa_g_max: 50 },
  };
  const t = targetParaTipoDia(ajustes, 'refeed', base);
  assert.equal(t.kcal_max, 2800);
  assert.equal(t.carbos_g, 325);
});

test('targetParaTipoDia: tipo inexistente cae a normal/base', () => {
  const base = { kcal_min: 2100, kcal_max: 2200, proteina_g: 160, carbos_g: 160, grasa_g_min: 90, grasa_g_max: 95 };
  const t = targetParaTipoDia({ normal: base }, 'keto', base);
  assert.equal(t.carbos_g, 160); // cae a normal
});

test('targetParaTipoDia: ajustes nulos => base', () => {
  const base = { kcal_min: 2100, kcal_max: 2200, proteina_g: 160, carbos_g: 160, grasa_g_min: 90, grasa_g_max: 95 };
  const t = targetParaTipoDia(null, 'leg_day', base);
  assert.deepEqual(t, base);
});

test('pctTarget: casos borde', () => {
  assert.equal(pctTarget(80, 160), 50);
  assert.equal(pctTarget(160, 160), 100);
  assert.equal(pctTarget(0, 160), 0);
  assert.equal(pctTarget(50, 0), 0); // target 0 => 0, no división por cero
  assert.equal(pctTarget(500, 100, 150), 150); // cap
});

test('r1: redondeo a 1 decimal', () => {
  assert.equal(r1(1.234), 1.2);
  assert.equal(r1(1.25), 1.3);
});
