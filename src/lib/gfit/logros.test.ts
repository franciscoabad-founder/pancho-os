import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarLogros, type ContextoLogros, type CatalogoLogro } from './logros.ts';

function catalogo(...logros: CatalogoLogro[]): CatalogoLogro[] {
  return logros;
}

function ctxBase(overrides: Partial<ContextoLogros> = {}): ContextoLogros {
  return {
    catalogo: [],
    logrosPrevios: [],
    sesiones: [],
    seriesHistoricas: [],
    hoy: '2026-07-15',
    ...overrides,
  };
}

test('primera_sesion: dispara una sola vez', () => {
  const logro: CatalogoLogro = { slug: 'primer-paso', activo: true, umbral: { tipo: 'primera_sesion' } };
  const ctx = ctxBase({ catalogo: catalogo(logro), sesiones: [{ fecha: '2026-07-15' }] });

  const primera = evaluarLogros(ctx);
  assert.deepEqual(primera, [{ slug: 'primer-paso', nivel: 1 }]);

  // Ya obtenido: no vuelve a dispararse aunque siga habiendo sesiones.
  const segunda = evaluarLogros({ ...ctx, logrosPrevios: [{ slug: 'primer-paso', nivel: 1 }] });
  assert.deepEqual(segunda, []);
});

test('primera_sesion: sin sesiones, no dispara', () => {
  const logro: CatalogoLogro = { slug: 'primer-paso', activo: true, umbral: { tipo: 'primera_sesion' } };
  const ctx = ctxBase({ catalogo: catalogo(logro), sesiones: [] });
  assert.deepEqual(evaluarLogros(ctx), []);
});

test('tonelaje_total: tier 2 (10k) dispara solo al cruzar 10000, no antes', () => {
  const logro: CatalogoLogro = {
    slug: 'volumen-mil',
    activo: true,
    umbral: { tipo: 'tonelaje_total', tiers: [1000, 10000, 100000] },
  };

  const seriesBajoTier2 = [{ fecha: '2026-07-01', pesoKg: 100, reps: 90, tipo: 'working' }]; // 9000 kg
  const ctxBajo = ctxBase({
    catalogo: catalogo(logro),
    seriesHistoricas: seriesBajoTier2,
    logrosPrevios: [{ slug: 'volumen-mil', nivel: 1 }], // tier 1 (1000kg) ya obtenido
  });
  const resultadoBajo = evaluarLogros(ctxBajo);
  assert.deepEqual(resultadoBajo, [], 'a 9000kg no debe disparar el tier 2 (10000kg)');

  const seriesCruzaTier2 = [{ fecha: '2026-07-01', pesoKg: 100, reps: 100, tipo: 'working' }]; // 10000 kg
  const ctxCruza = ctxBase({
    catalogo: catalogo(logro),
    seriesHistoricas: seriesCruzaTier2,
    logrosPrevios: [{ slug: 'volumen-mil', nivel: 1 }],
  });
  const resultadoCruza = evaluarLogros(ctxCruza);
  assert.deepEqual(resultadoCruza, [{ slug: 'volumen-mil', nivel: 2 }]);
});

test('tonelaje_total: sin logros previos, cruzar 10000kg de una otorga tier 1 y tier 2 juntos', () => {
  const logro: CatalogoLogro = {
    slug: 'volumen-mil',
    activo: true,
    umbral: { tipo: 'tonelaje_total', tiers: [1000, 10000, 100000] },
  };
  const series = [{ fecha: '2026-07-01', pesoKg: 100, reps: 100, tipo: 'working' }]; // 10000 kg
  const ctx = ctxBase({ catalogo: catalogo(logro), seriesHistoricas: series });
  const resultado = evaluarLogros(ctx);
  assert.deepEqual(resultado, [
    { slug: 'volumen-mil', nivel: 1 },
    { slug: 'volumen-mil', nivel: 2 },
  ]);
});

test('racha_dias: exactamente 7 dispara el tier de 7 días', () => {
  const logro: CatalogoLogro = { slug: 'racha-de-hierro', activo: true, umbral: { tipo: 'racha_dias', dias: [7, 30, 90] } };
  const sesiones = ['09', '10', '11', '12', '13', '14', '15'].map((d) => ({ fecha: `2026-07-${d}` }));
  const ctx = ctxBase({ catalogo: catalogo(logro), sesiones, hoy: '2026-07-15' });
  const resultado = evaluarLogros(ctx);
  assert.deepEqual(resultado, [{ slug: 'racha-de-hierro', nivel: 1 }]);
});

test('racha_dias: 6 días consecutivos NO dispara el tier de 7', () => {
  const logro: CatalogoLogro = { slug: 'racha-de-hierro', activo: true, umbral: { tipo: 'racha_dias', dias: [7, 30, 90] } };
  const sesiones = ['10', '11', '12', '13', '14', '15'].map((d) => ({ fecha: `2026-07-${d}` }));
  const ctx = ctxBase({ catalogo: catalogo(logro), sesiones, hoy: '2026-07-15' });
  assert.deepEqual(evaluarLogros(ctx), []);
});

test('racha_dias: racha rota (falta un día) no cuenta los días previos al hueco', () => {
  const logro: CatalogoLogro = { slug: 'racha-de-hierro', activo: true, umbral: { tipo: 'racha_dias', dias: [7] } };
  const sesiones = ['05', '06', '07', '09', '10', '11', '12', '13', '14', '15'].map((d) => ({ fecha: `2026-07-${d}` }));
  // Falta el 08: la racha actual (que termina hoy) es 09..15 = 7 días -> SÍ dispara.
  const ctx = ctxBase({ catalogo: catalogo(logro), sesiones, hoy: '2026-07-15' });
  assert.deepEqual(evaluarLogros(ctx), [{ slug: 'racha-de-hierro', nivel: 1 }]);
});

test('pr: dispara cuando prNuevo=true, nivel incrementa en cada nueva marca', () => {
  const logro: CatalogoLogro = { slug: 'record-personal', activo: true, umbral: { tipo: 'pr' } };
  const ctx = ctxBase({ catalogo: catalogo(logro), prNuevo: true });
  assert.deepEqual(evaluarLogros(ctx), [{ slug: 'record-personal', nivel: 1 }]);

  const ctxSegundoPr = ctxBase({
    catalogo: catalogo(logro),
    prNuevo: true,
    logrosPrevios: [{ slug: 'record-personal', nivel: 1 }],
  });
  assert.deepEqual(evaluarLogros(ctxSegundoPr), [{ slug: 'record-personal', nivel: 2 }]);
});

test('pr: sin prNuevo, no dispara', () => {
  const logro: CatalogoLogro = { slug: 'record-personal', activo: true, umbral: { tipo: 'pr' } };
  assert.deepEqual(evaluarLogros(ctxBase({ catalogo: catalogo(logro), prNuevo: false })), []);
});

test('meses_activos: dispara solo con 12 meses distintos', () => {
  const logro: CatalogoLogro = { slug: 'ano-completo', activo: true, umbral: { tipo: 'meses_activos', meses: 12 } };
  const sesiones11 = Array.from({ length: 11 }, (_, i) => ({ fecha: `2025-${String(i + 1).padStart(2, '0')}-05` }));
  assert.deepEqual(evaluarLogros(ctxBase({ catalogo: catalogo(logro), sesiones: sesiones11 })), []);

  const sesiones12 = Array.from({ length: 12 }, (_, i) => ({ fecha: `2025-${String(i + 1).padStart(2, '0')}-05` }));
  assert.deepEqual(evaluarLogros(ctxBase({ catalogo: catalogo(logro), sesiones: sesiones12 })), [
    { slug: 'ano-completo', nivel: 1 },
  ]);
});

test('sorpresa_sesiones: dispara solo al alcanzar el umbral oculto', () => {
  const logro: CatalogoLogro = {
    slug: 'caja-sorpresa',
    activo: true,
    umbral: { tipo: 'sorpresa_sesiones', umbral_actual: 12 },
  };
  const sesiones11 = Array.from({ length: 11 }, (_, i) => ({ fecha: `2026-07-${String(i + 1).padStart(2, '0')}` }));
  assert.deepEqual(evaluarLogros(ctxBase({ catalogo: catalogo(logro), sesiones: sesiones11 })), []);

  const sesiones12 = Array.from({ length: 12 }, (_, i) => ({ fecha: `2026-07-${String(i + 1).padStart(2, '0')}` }));
  assert.deepEqual(evaluarLogros(ctxBase({ catalogo: catalogo(logro), sesiones: sesiones12 })), [
    { slug: 'caja-sorpresa', nivel: 1 },
  ]);
});

test('sesion_tras_lapso (landmark): dispara si hoy es lunes o día 1 de mes y hay sesión hoy', () => {
  const logro: CatalogoLogro = {
    slug: 'reinicio-con-fuerza',
    activo: true,
    umbral: { tipo: 'sesion_tras_lapso', modo: 'landmark' },
  };
  // 2026-07-13 es lunes (ISO).
  const ctx = ctxBase({ catalogo: catalogo(logro), sesiones: [{ fecha: '2026-07-13' }], hoy: '2026-07-13' });
  assert.deepEqual(evaluarLogros(ctx), [{ slug: 'reinicio-con-fuerza', nivel: 1 }]);

  // Martes 14, sin ser día 1 de mes: no dispara.
  const ctxMartes = ctxBase({ catalogo: catalogo(logro), sesiones: [{ fecha: '2026-07-14' }], hoy: '2026-07-14' });
  assert.deepEqual(evaluarLogros(ctxMartes), []);
});

test('sesion_tras_lapso (tras_racha_rota): dispara solo si hubo un hueco real antes de la sesión de hoy', () => {
  const logro: CatalogoLogro = {
    slug: 'antirrendicion',
    activo: true,
    umbral: { tipo: 'sesion_tras_lapso', modo: 'tras_racha_rota', diasGap: 3 },
  };
  const conHueco = ctxBase({
    catalogo: catalogo(logro),
    sesiones: [{ fecha: '2026-07-01' }, { fecha: '2026-07-15' }],
    hoy: '2026-07-15',
  });
  assert.deepEqual(evaluarLogros(conHueco), [{ slug: 'antirrendicion', nivel: 1 }]);

  const sinHueco = ctxBase({
    catalogo: catalogo(logro),
    sesiones: [{ fecha: '2026-07-14' }, { fecha: '2026-07-15' }],
    hoy: '2026-07-15',
  });
  assert.deepEqual(evaluarLogros(sinHueco), []);
});

test('adherencia_pct: dispara al alcanzar el % objetivo en la ventana de semanas', () => {
  const logro: CatalogoLogro = {
    slug: 'constancia-de-oro',
    activo: true,
    umbral: { tipo: 'adherencia_pct', pct: 50, semanas: 1 }, // 50% de 7 días = 3.5 -> 4 días
  };
  const sesiones4de7 = ['09', '11', '13', '15'].map((d) => ({ fecha: `2026-07-${d}` }));
  const ctx = ctxBase({ catalogo: catalogo(logro), sesiones: sesiones4de7, hoy: '2026-07-15' });
  assert.deepEqual(evaluarLogros(ctx), [{ slug: 'constancia-de-oro', nivel: 1 }]);

  const sesiones2de7 = ['09', '15'].map((d) => ({ fecha: `2026-07-${d}` }));
  const ctxBajo = ctxBase({ catalogo: catalogo(logro), sesiones: sesiones2de7, hoy: '2026-07-15' });
  assert.deepEqual(evaluarLogros(ctxBajo), []);
});

test('grupos_mev_semana: dispara al alcanzar el MEV en N grupos en la semana', () => {
  const logro: CatalogoLogro = {
    slug: 'explorador-muscular',
    activo: true,
    umbral: { tipo: 'grupos_mev_semana', grupos: 2 },
  };
  // chest MEV=11, biceps MEV=9 (ver recovery.ts).
  const series = [
    ...Array.from({ length: 11 }, () => ({ fecha: '2026-07-15', pesoKg: 80, reps: 8, tipo: 'working', grupo: 'chest' })),
    ...Array.from({ length: 9 }, () => ({ fecha: '2026-07-14', pesoKg: 20, reps: 10, tipo: 'working', grupo: 'biceps' })),
  ];
  const ctx = ctxBase({ catalogo: catalogo(logro), seriesHistoricas: series, hoy: '2026-07-15' });
  assert.deepEqual(evaluarLogros(ctx), [{ slug: 'explorador-muscular', nivel: 1 }]);
});

test('doble_progresion: dispara solo cuando el llamador confirma el ciclo completado', () => {
  const logro: CatalogoLogro = { slug: 'doble-progresion', activo: true, umbral: { tipo: 'doble_progresion' } };
  assert.deepEqual(evaluarLogros(ctxBase({ catalogo: catalogo(logro), dobleProgresionCompletada: false })), []);
  assert.deepEqual(evaluarLogros(ctxBase({ catalogo: catalogo(logro), dobleProgresionCompletada: true })), [
    { slug: 'doble-progresion', nivel: 1 },
  ]);
});

test('logros inactivos se ignoran', () => {
  const logro: CatalogoLogro = { slug: 'primer-paso', activo: false, umbral: { tipo: 'primera_sesion' } };
  const ctx = ctxBase({ catalogo: catalogo(logro), sesiones: [{ fecha: '2026-07-15' }] });
  assert.deepEqual(evaluarLogros(ctx), []);
});
