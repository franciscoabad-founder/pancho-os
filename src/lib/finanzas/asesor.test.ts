import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticarFinanzas } from './asesor.ts';

test('propone seguimiento para cobros vencidos sin mutar datos', () => {
  const resultado = diagnosticarFinanzas(
    [{ saldo: 100, moneda: 'USD', estado: 'activa' }],
    [{ id: 'c1', cliente: 'Cliente', monto: 50, moneda: 'USD', estado: 'esperando', fecha_esperada: '2026-08-20' }],
    [], [], '2026-08-26',
  );
  assert.equal(resultado.propuestas[0]?.id, 'cobro:c1');
  assert.match(resultado.propuestas[0]?.recomendacion ?? '', /no cambia/i);
});

test('avisa cuando pagos pendientes superan liquidez disponible', () => {
  const resultado = diagnosticarFinanzas(
    [{ saldo: 10, moneda: 'USD', estado: 'activa' }], [],
    [{ id: 'p1', beneficiario: 'Proveedor', monto: 20, moneda: 'USD', estado: 'pendiente', fecha_limite: '2026-09-10' }], [], '2026-08-26',
  );
  assert.ok(resultado.propuestas.some((p) => p.id === 'liquidez:pendiente'));
});
