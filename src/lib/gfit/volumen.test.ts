import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tonelaje,
  volumenPorRango,
  tiempoPorRango,
  muscleBreakdown,
  calendarioEntrenos,
} from './volumen.ts';

test('tonelaje: excluye warmup, suma working/drop/failure', () => {
  const series = [
    { fecha: '2026-07-01', pesoKg: 20, reps: 10, tipo: 'warmup' }, // excluida
    { fecha: '2026-07-01', pesoKg: 80, reps: 8, tipo: 'working' }, // 640
    { fecha: '2026-07-01', pesoKg: 60, reps: 6, tipo: 'drop' }, // 360
    { fecha: '2026-07-01', pesoKg: 40, reps: 4, tipo: 'failure' }, // 160
  ];
  assert.equal(tonelaje(series), 1160);
});

test('tonelaje: sin series efectivas => 0', () => {
  assert.equal(tonelaje([{ fecha: '2026-07-01', pesoKg: 100, reps: 5, tipo: 'warmup' }]), 0);
  assert.equal(tonelaje([]), 0);
});

test('volumenPorRango: 7d filtra fuera de rango y rellena días sin entreno con 0', () => {
  const hoy = '2026-07-15';
  const series = [
    { fecha: '2026-07-15', pesoKg: 100, reps: 5, tipo: 'working' }, // 500, hoy
    { fecha: '2026-07-10', pesoKg: 100, reps: 5, tipo: 'working' }, // 500, dentro de 7d
    { fecha: '2026-06-01', pesoKg: 999, reps: 10, tipo: 'working' }, // fuera de 7d
  ];
  const r = volumenPorRango(series, '7d', hoy);
  assert.equal(r.total, 1000);
  assert.equal(r.porDia.length, 7);
  assert.equal(r.porDia[0].fecha, '2026-07-09');
  assert.equal(r.porDia[r.porDia.length - 1].fecha, hoy);
  const diaVacio = r.porDia.find((d) => d.fecha === '2026-07-12');
  assert.equal(diaVacio?.total, 0);
});

test('volumenPorRango: all sin filtro de fecha', () => {
  const series = [
    { fecha: '2020-01-01', pesoKg: 10, reps: 10, tipo: 'working' },
    { fecha: '2026-07-15', pesoKg: 10, reps: 10, tipo: 'working' },
  ];
  const r = volumenPorRango(series, 'all', '2026-07-15');
  assert.equal(r.total, 200);
});

test('tiempoPorRango: suma minutos por rango, misma forma que volumenPorRango', () => {
  const hoy = '2026-07-15';
  const sesiones = [
    { fecha: '2026-07-15', duracionMin: 45 },
    { fecha: '2026-07-14', duracionMin: 30 },
    { fecha: '2020-01-01', duracionMin: 999 },
  ];
  const r = tiempoPorRango(sesiones, '14d', hoy);
  assert.equal(r.total, 75);
  assert.equal(r.porDia.length, 14);
});

test('muscleBreakdown: cuenta un set por cada grupo primario del ejercicio, excluye warmup', () => {
  const ejercicios = [
    { id: 'press-banca', gruposPrimarios: ['chest', 'triceps'] },
    { id: 'curl-biceps', gruposPrimarios: ['biceps'] },
  ];
  const series = [
    { fecha: '2026-07-01', pesoKg: 80, reps: 8, tipo: 'working', ejercicioId: 'press-banca' },
    { fecha: '2026-07-01', pesoKg: 20, reps: 10, tipo: 'warmup', ejercicioId: 'press-banca' },
    { fecha: '2026-07-02', pesoKg: 15, reps: 12, tipo: 'working', ejercicioId: 'curl-biceps' },
  ];
  const breakdown = muscleBreakdown(series, ejercicios, 3, '2026-07-15');
  assert.deepEqual(breakdown, { chest: 1, triceps: 1, biceps: 1 });
});

test('muscleBreakdown: respeta la ventana de meses', () => {
  const ejercicios = [{ id: 'press-banca', gruposPrimarios: ['chest'] }];
  const series = [
    { fecha: '2025-01-01', pesoKg: 80, reps: 8, tipo: 'working', ejercicioId: 'press-banca' }, // fuera de ventana
  ];
  const breakdown = muscleBreakdown(series, ejercicios, 3, '2026-07-15');
  assert.deepEqual(breakdown, {});
});

test('calendarioEntrenos: fechas únicas y ordenadas', () => {
  const fechas = calendarioEntrenos([
    { fecha: '2026-07-10' },
    { fecha: '2026-07-05' },
    { fecha: '2026-07-10' },
  ]);
  assert.deepEqual(fechas, ['2026-07-05', '2026-07-10']);
});
