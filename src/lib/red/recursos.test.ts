import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceLazos } from './recursos.ts';

test('balanceLazos: sin personas => todo 0, sin alerta', () => {
  const b = balanceLazos([]);
  assert.deepEqual(b, { operacional: 0, personal: 0, estrategico: 0, alerta: null });
});

test('balanceLazos: cero estrategicos dispara alerta', () => {
  const personas = [{ tipo_lazo: 'operacional' as const }, { tipo_lazo: 'personal' as const }];
  const b = balanceLazos(personas);
  assert.equal(b.estrategico, 0);
  assert.ok(b.alerta && b.alerta.includes('estrategicos'));
});

test('balanceLazos: 20% exacto estrategico NO dispara alerta (umbral inclusivo)', () => {
  const personas = [
    { tipo_lazo: 'estrategico' as const },
    { tipo_lazo: 'operacional' as const },
    { tipo_lazo: 'operacional' as const },
    { tipo_lazo: 'operacional' as const },
    { tipo_lazo: 'operacional' as const },
  ];
  const b = balanceLazos(personas);
  assert.equal(b.estrategico, 0.2);
  assert.equal(b.alerta, null);
});

test('balanceLazos: proporciones suman 1', () => {
  const personas = [
    { tipo_lazo: 'operacional' as const },
    { tipo_lazo: 'personal' as const },
    { tipo_lazo: 'estrategico' as const },
  ];
  const b = balanceLazos(personas);
  assert.ok(Math.abs(b.operacional + b.personal + b.estrategico - 1) < 1e-9);
});
