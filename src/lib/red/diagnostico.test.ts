import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumen, type PersonaDiagnostico } from './diagnostico.ts';

test('resumen: 0 personas => valores nulos/0', () => {
  const diag = resumen([], 0);

  assert.equal(diag.apertura.densidad, 0);
  assert.equal(diag.apertura.banda, 'muy-abierta');
  assert.equal(diag.apertura.distanciaAlIdeal, -0.5);

  assert.equal(diag.diversidad.entropia, 0);
  assert.deepEqual(diag.diversidad.porArea, []);

  assert.equal(diag.balance.operacional, 0);
  assert.equal(diag.balance.personal, 0);
  assert.equal(diag.balance.estrategico, 0);
  assert.equal(diag.balance.alerta, null);
});

test('resumen: caso con personas y conexiones', () => {
  const personas: PersonaDiagnostico[] = [
    { area: 'Ingeniería', tipo_lazo: 'operacional' },
    { area: 'Ingeniería', tipo_lazo: 'operacional' },
    { area: 'Diseño', tipo_lazo: 'estrategico' },
    { area: 'Marketing', tipo_lazo: 'personal' },
  ];

  // 4 personas = 6 conexiones posibles. Si hay 3 conexiones: densidad = 0.5.
  const nConexiones = 3;
  const diag = resumen(personas, nConexiones);

  // Apertura
  assert.equal(diag.apertura.densidad, 0.5);
  assert.equal(diag.apertura.banda, 'ideal');
  assert.equal(diag.apertura.distanciaAlIdeal, 0);

  // Diversidad
  assert.ok(diag.diversidad.entropia > 0 && diag.diversidad.entropia <= 1);
  assert.equal(diag.diversidad.porArea.length, 3);

  const ingArea = diag.diversidad.porArea.find(a => a.area === 'Ingeniería');
  assert.equal(ingArea?.pct, 50);

  // Balance
  assert.equal(diag.balance.operacional, 0.5);
  assert.equal(diag.balance.personal, 0.25);
  assert.equal(diag.balance.estrategico, 0.25);
  assert.equal(diag.balance.alerta, null);
});

test('resumen: caso con alerta estrategico bajo', () => {
  const personas: PersonaDiagnostico[] = [
    { area: 'Ventas', tipo_lazo: 'operacional' },
    { area: 'Ventas', tipo_lazo: 'operacional' },
    { area: 'Ventas', tipo_lazo: 'operacional' },
    { area: 'Ventas', tipo_lazo: 'operacional' },
    { area: 'Marketing', tipo_lazo: 'personal' },
    // 5 personas. 0 estratégicas, que es < 20%
  ];

  const diag = resumen(personas, 10); // densidad 1
  assert.equal(diag.apertura.densidad, 1);
  assert.equal(diag.apertura.banda, 'muy-cerrada');
  assert.ok(diag.apertura.distanciaAlIdeal > 0);

  assert.equal(diag.balance.estrategico, 0);
  assert.ok(diag.balance.alerta !== null);
  assert.ok(diag.balance.alerta.includes('Los vinculos estrategicos son 0%'));
});
