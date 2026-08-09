import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sugerenciaOverload, incrementoPorPatron,
  progressIndex, e1rmEpley, ajusteRecuperacion, promedioMovil,
} from './progresion.ts';

// ── (a) Progressive overload ──────────────────────────────────────────────────
test('overload: sin historial => mantener', () => {
  const r = sugerenciaOverload([], { repsMin: 8, repsMax: 12, patron: 'push_h' });
  assert.equal(r.accion, 'mantener');
  assert.equal(r.pesoSugerido, null);
});

test('overload: tope 2 sesiones seguidas (upper) => +2.5kg', () => {
  const sets = [
    { fecha: '2026-07-14', reps: 12, peso_kg: 40, tipo_set: 'working' },
    { fecha: '2026-07-14', reps: 12, peso_kg: 40, tipo_set: 'working' },
    { fecha: '2026-07-12', reps: 12, peso_kg: 40, tipo_set: 'working' },
    { fecha: '2026-07-12', reps: 12, peso_kg: 40, tipo_set: 'working' },
  ];
  const r = sugerenciaOverload(sets, { repsMin: 8, repsMax: 12, patron: 'push_h' });
  assert.equal(r.accion, 'subir');
  assert.equal(r.deltaKg, 2.5);
  assert.equal(r.pesoSugerido, 42.5);
});

test('overload: tope 2 sesiones (lower/compuesto) => +5kg', () => {
  const sets = [
    { fecha: '2026-07-14', reps: 10, peso_kg: 100, tipo_set: 'working' },
    { fecha: '2026-07-12', reps: 11, peso_kg: 100, tipo_set: 'working' },
  ];
  const r = sugerenciaOverload(sets, { repsMin: 6, repsMax: 10, patron: 'squat' });
  assert.equal(r.accion, 'subir');
  assert.equal(r.deltaKg, 5);
  assert.equal(r.pesoSugerido, 105);
});

test('overload: falló el mínimo 2 veces => bajar 10%', () => {
  const sets = [
    { fecha: '2026-07-14', reps: 5, peso_kg: 50, tipo_set: 'working' },
    { fecha: '2026-07-14', reps: 4, peso_kg: 50, tipo_set: 'working' },
  ];
  const r = sugerenciaOverload(sets, { repsMin: 8, repsMax: 12, patron: 'push_v' });
  assert.equal(r.accion, 'bajar');
  assert.equal(r.deltaKg, -5);
  assert.equal(r.pesoSugerido, 45);
});

test('overload: un solo set en el tope => mantener (no 2 sesiones)', () => {
  const sets = [{ fecha: '2026-07-14', reps: 12, peso_kg: 40, tipo_set: 'working' }];
  const r = sugerenciaOverload(sets, { repsMin: 8, repsMax: 12, patron: 'push_h' });
  assert.equal(r.accion, 'mantener');
  assert.equal(r.pesoSugerido, 40);
});

test('overload: warmups se ignoran', () => {
  const sets = [
    { fecha: '2026-07-14', reps: 20, peso_kg: 20, tipo_set: 'warmup' },
    { fecha: '2026-07-14', reps: 10, peso_kg: 40, tipo_set: 'working' },
  ];
  const r = sugerenciaOverload(sets, { repsMin: 8, repsMax: 12, patron: 'push_h' });
  assert.equal(r.accion, 'mantener'); // no llegó al tope (12)
});

test('overload: pesos 0 no rompe (peso corporal)', () => {
  const sets = [
    { fecha: '2026-07-14', reps: 15, peso_kg: 0, tipo_set: 'working' },
    { fecha: '2026-07-12', reps: 15, peso_kg: 0, tipo_set: 'working' },
  ];
  const r = sugerenciaOverload(sets, { repsMin: 10, repsMax: 15, patron: 'squat' });
  assert.equal(r.accion, 'subir');
  assert.equal(r.pesoSugerido, null); // sin peso de referencia
});

test('incrementoPorPatron', () => {
  assert.equal(incrementoPorPatron('squat'), 5);
  assert.equal(incrementoPorPatron('hinge'), 5);
  assert.equal(incrementoPorPatron('push_h'), 2.5);
  assert.equal(incrementoPorPatron(null), 2.5);
});

// ── (b) Progress Index ────────────────────────────────────────────────────────
test('e1rmEpley: fórmula y casos borde', () => {
  assert.equal(e1rmEpley(100, 5), 116.7);
  assert.equal(e1rmEpley(100, 1), 100); // 1 rep => peso
  assert.equal(e1rmEpley(100, 0), 100); // 0 reps => peso
  assert.equal(e1rmEpley(0, 10), 0);    // sin peso => 0
});

test('progressIndex: sin sets => vacío, ratios null', () => {
  const r = progressIndex([]);
  assert.deepEqual(r.volumenPorGrupo, {});
  assert.equal(r.ratios.pushPull, null);
  assert.equal(r.ratios.squatHinge, null);
  assert.deepEqual(r.alertas, []);
});

test('progressIndex: volumen por grupo y mejor e1RM', () => {
  const sets = [
    { ejercicio_id: 'a', ejercicio_nombre: 'Press banca', grupo: 'Pecho', patron: 'push_h', reps: 10, peso_kg: 60, tipo_set: 'working' },
    { ejercicio_id: 'a', ejercicio_nombre: 'Press banca', grupo: 'Pecho', patron: 'push_h', reps: 5, peso_kg: 80, tipo_set: 'working' },
  ];
  const r = progressIndex(sets);
  assert.equal(r.volumenPorGrupo['Pecho'], 10 * 60 + 5 * 80); // 1000
  assert.equal(r.e1rmPorEjercicio['a'].e1rm, e1rmEpley(80, 5)); // mejor set
});

test('progressIndex: alerta cuando push/pull > 1.5', () => {
  const sets = [
    { ejercicio_id: 'p', ejercicio_nombre: 'Press', grupo: 'Pecho', patron: 'push_h', reps: 10, peso_kg: 100, tipo_set: 'working' },
    { ejercicio_id: 'r', ejercicio_nombre: 'Remo', grupo: 'Espalda', patron: 'pull_h', reps: 10, peso_kg: 40, tipo_set: 'working' },
  ];
  const r = progressIndex(sets);
  assert.equal(r.ratios.pushPull, 2.5);
  assert.ok(r.alertas.some((a) => a.includes('Push/Pull')));
});

test('progressIndex: warmups no cuentan al volumen', () => {
  const sets = [
    { ejercicio_id: 'a', ejercicio_nombre: 'X', grupo: 'Pecho', patron: 'push_h', reps: 10, peso_kg: 100, tipo_set: 'warmup' },
  ];
  const r = progressIndex(sets);
  assert.equal(r.volumenPorGrupo['Pecho'], undefined);
});

test('progressIndex: solo un lado del patrón => Infinity y alerta', () => {
  const sets = [
    { ejercicio_id: 's', ejercicio_nombre: 'Sentadilla', grupo: 'Piernas', patron: 'squat', reps: 10, peso_kg: 100, tipo_set: 'working' },
  ];
  const r = progressIndex(sets);
  assert.equal(r.ratios.squatHinge, Infinity);
  assert.ok(r.alertas.some((a) => a.includes('Squat/Hinge')));
});

// ── (c) Recuperación ──────────────────────────────────────────────────────────
test('ajusteRecuperacion: <5h => -20%', () => {
  const r = ajusteRecuperacion(4.5);
  assert.equal(r.ajustePct, -20);
  assert.ok(r.aviso && r.aviso.includes('20%'));
});

test('ajusteRecuperacion: 5-6h => -10%', () => {
  assert.equal(ajusteRecuperacion(5.5).ajustePct, -10);
});

test('ajusteRecuperacion: >=6h => 0', () => {
  assert.equal(ajusteRecuperacion(7).ajustePct, 0);
  assert.equal(ajusteRecuperacion(7).aviso, null);
});

test('ajusteRecuperacion: null => sin ajuste', () => {
  assert.equal(ajusteRecuperacion(null).ajustePct, 0);
  assert.equal(ajusteRecuperacion(undefined).ajustePct, 0);
  assert.equal(ajusteRecuperacion(NaN).ajustePct, 0);
});

test('promedioMovil: ventana 7', () => {
  const serie = [
    { x: 'd1', y: 10 }, { x: 'd2', y: 20 }, { x: 'd3', y: 30 },
  ];
  const mm = promedioMovil(serie, 7);
  assert.equal(mm[0].y, 10);
  assert.equal(mm[1].y, 15);
  assert.equal(mm[2].y, 20);
});
