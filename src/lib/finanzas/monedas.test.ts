import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MONEDA_BASE,
  MONEDAS_COMUNES,
  TASAS_ESTATICAS,
  convertirAUsd,
  formatearMonto,
  normalizarMoneda,
  redondearCentavos,
} from './monedas.ts';

test('la moneda base del OS es USD, no MXN', () => {
  assert.equal(MONEDA_BASE, 'USD');
  assert.equal(TASAS_ESTATICAS.USD, 1);
  assert.equal(MONEDAS_COMUNES[0]?.codigo, 'USD');
});

test('normalizarMoneda deja codigos ISO en mayusculas y cae a USD ante basura', () => {
  assert.equal(normalizarMoneda('mxn'), 'MXN');
  assert.equal(normalizarMoneda('  eur '), 'EUR');
  assert.equal(normalizarMoneda(''), 'USD');
  assert.equal(normalizarMoneda('pesos'), 'USD');
  assert.equal(normalizarMoneda(null), 'USD');
  assert.equal(normalizarMoneda(42), 'USD');
});

test('un gasto en USD no se toca ni se marca aproximado', () => {
  const c = convertirAUsd(120.5, 'USD', { MXN: 18 });
  assert.equal(c.monto_usd, 120.5);
  assert.equal(c.tasa, 1);
  assert.equal(c.aproximada, false);
  assert.equal(c.moneda, 'USD');
});

test('con tasa del dia convierte exacto y NO marca aproximada', () => {
  const c = convertirAUsd(370, 'MXN', { MXN: 18.5 });
  assert.equal(c.monto_usd, 20);
  assert.equal(c.tasa, 18.5);
  assert.equal(c.aproximada, false);
});

test('sin tabla de tasas usa el respaldo estatico y marca aproximada', () => {
  const c = convertirAUsd(370, 'MXN', null);
  assert.equal(c.tasa, TASAS_ESTATICAS.MXN);
  assert.equal(c.monto_usd, 20);
  assert.equal(c.aproximada, true);
});

test('si la tabla del dia no cubre la moneda, cae al estatico y marca aproximada', () => {
  const c = convertirAUsd(100, 'COP', { MXN: 18.5 });
  assert.equal(c.tasa, TASAS_ESTATICAS.COP);
  assert.equal(c.aproximada, true);
});

test('tasa invalida en la tabla del dia (0, negativa o NaN) no se usa', () => {
  for (const mala of [0, -3, Number.NaN]) {
    const c = convertirAUsd(185, 'MXN', { MXN: mala });
    assert.equal(c.tasa, TASAS_ESTATICAS.MXN, `tasa mala ${mala}`);
    assert.equal(c.aproximada, true);
  }
});

test('moneda desconocida no inventa numero: deja el monto y marca aproximada', () => {
  const c = convertirAUsd(500, 'XYZ', { MXN: 18.5 });
  assert.equal(c.monto_usd, 500);
  assert.equal(c.tasa, 1);
  assert.equal(c.aproximada, true);
  assert.equal(c.moneda, 'XYZ');
});

test('montos no numericos se convierten en 0 en vez de NaN', () => {
  for (const basura of [undefined, null, '', 'hola', {}]) {
    assert.equal(convertirAUsd(basura, 'MXN').monto_usd, 0);
  }
});

test('monto en texto numerico se acepta (viene asi de los formularios)', () => {
  assert.equal(convertirAUsd('370', 'MXN', { MXN: 18.5 }).monto_usd, 20);
});

test('el resultado siempre viene redondeado a centavos', () => {
  const c = convertirAUsd(1000, 'COP', { COP: 4123.4567 });
  assert.equal(c.monto_usd, redondearCentavos(1000 / 4123.4567));
  assert.equal(Math.round(c.monto_usd * 100), c.monto_usd * 100);
});

test('redondearCentavos no arrastra el error binario clasico', () => {
  assert.equal(redondearCentavos(1.005), 1.01);
  assert.equal(redondearCentavos(0.1 + 0.2), 0.3);
});

test('monedas grandes: 4100 COP por USD da 1 USD', () => {
  assert.equal(convertirAUsd(4100, 'COP', null).monto_usd, 1);
});

test('formatearMonto usa USD por defecto', () => {
  assert.match(formatearMonto(1500), /USD$/);
  assert.match(formatearMonto(1500, 'MXN'), /MXN$/);
});

test('el catalogo de monedas comunes cubre al menos 15 y todas tienen tasa estatica', () => {
  assert.ok(MONEDAS_COMUNES.length >= 15);
  for (const m of MONEDAS_COMUNES) {
    assert.ok(TASAS_ESTATICAS[m.codigo] > 0, `${m.codigo} sin tasa estatica`);
  }
});
