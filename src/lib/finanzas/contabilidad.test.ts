import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gastoEnUsd, resumenMensual } from './contabilidad.ts';

const gastos = [
  { fecha: '2026-08-03', categoria: 'comida', monto: 40, moneda: 'USD', monto_usd: 40 },
  { fecha: '2026-08-10', categoria: 'comida', monto: 370, moneda: 'MXN', monto_usd: 20 },
  { fecha: '2026-08-15', categoria: 'transporte', monto: 15, moneda: 'USD', monto_usd: 15 },
  { fecha: '2026-07-31', categoria: 'comida', monto: 999, moneda: 'USD', monto_usd: 999 },
];

const porCobrar = [
  { monto: 1000, moneda: 'USD', estado: 'cobrado', fecha_esperada: '2026-08-05' },
  { monto: 500, moneda: 'USD', estado: 'esperando', fecha_esperada: '2026-08-20' },
  { monto: 700, moneda: 'USD', estado: 'cobrado', fecha_esperada: '2026-07-05' },
];

const cuentas = [
  { nombre: 'Wise', moneda: 'USD', saldo: 300, estado: 'activa' },
  { nombre: 'Metamask', moneda: 'USD', saldo: 150, estado: 'activa' },
  { nombre: 'Banco Ecuador', moneda: 'USD', saldo: 0, estado: 'bloqueada' },
];

test('suma solo los gastos del mes pedido y en USD', () => {
  const r = resumenMensual('2026-08', gastos, porCobrar, cuentas);
  assert.equal(r.gastos_usd, 75); // 40 + 20 + 15, el de julio queda fuera
});

test('ingresos cuentan solo por_cobrar cobrado dentro del mes', () => {
  const r = resumenMensual('2026-08', gastos, porCobrar, cuentas);
  assert.equal(r.ingresos_usd, 1000); // ni el esperando ni el cobrado de julio
});

test('neto es ingresos menos gastos', () => {
  const r = resumenMensual('2026-08', gastos, porCobrar, cuentas);
  assert.equal(r.neto_usd, 925);
});

test('el desglose por categoria viene ordenado de mayor a menor con porcentaje', () => {
  const r = resumenMensual('2026-08', gastos, porCobrar, cuentas);
  assert.deepEqual(r.por_categoria.map((c) => c.categoria), ['comida', 'transporte']);
  assert.equal(r.por_categoria[0]?.total_usd, 60);
  assert.equal(r.por_categoria[0]?.pct, 80);
  assert.equal(r.por_categoria[1]?.total_usd, 15);
});

test('los gastos sin categoria se agrupan en "Sin categoria"', () => {
  const r = resumenMensual('2026-08', [{ fecha: '2026-08-01', monto: 10, moneda: 'USD', monto_usd: 10 }], [], []);
  assert.equal(r.por_categoria[0]?.categoria, 'Sin categoria');
});

test('las cuentas bloqueadas o cerradas no cuentan como saldo disponible', () => {
  const r = resumenMensual('2026-08', gastos, porCobrar, [
    ...cuentas,
    { nombre: 'Vieja', moneda: 'USD', saldo: 90, estado: 'cerrada' },
  ]);
  assert.equal(r.saldo_cuentas_usd, 450); // 300 + 150
  assert.equal(r.saldo_no_disponible_usd, 90); // 0 del banco congelado + 90
});

test('saldos en otra moneda se llevan a USD para el total', () => {
  const r = resumenMensual('2026-08', [], [], [{ nombre: 'MX', moneda: 'MXN', saldo: 1850, estado: 'activa' }]);
  assert.equal(r.saldo_cuentas_usd, 100); // 1850 / 18.5
});

test('un mes sin movimientos devuelve ceros y no divide por cero', () => {
  const r = resumenMensual('2026-01', gastos, porCobrar, cuentas);
  assert.equal(r.gastos_usd, 0);
  assert.equal(r.ingresos_usd, 0);
  assert.equal(r.neto_usd, 0);
  assert.deepEqual(r.por_categoria, []);
});

test('gastoEnUsd prefiere monto_usd guardado sobre reconvertir', () => {
  assert.equal(gastoEnUsd({ monto: 370, moneda: 'MXN', monto_usd: 19.44 }), 19.44);
});

test('gastoEnUsd convierte al vuelo las filas viejas sin monto_usd', () => {
  assert.equal(gastoEnUsd({ monto: 370, moneda: 'MXN' }), 20);
  assert.equal(gastoEnUsd({ monto: 50 }), 50); // sin moneda asume USD
});

test('cuenta cuantos gastos del mes quedaron con conversion aproximada', () => {
  const r = resumenMensual(
    '2026-08',
    [
      { fecha: '2026-08-01', monto: 10, moneda: 'USD', monto_usd: 10 },
      { fecha: '2026-08-02', monto: 100, moneda: 'COP', monto_usd: 0.02, conversion_aproximada: true },
    ] as never,
    [],
    [],
  );
  assert.equal(r.gastos_aproximados, 1);
});
