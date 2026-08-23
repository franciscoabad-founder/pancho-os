import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pesoDelDia,
  serieDePeso,
  ultimoPesoConocido,
  conflictosDePeso,
  CONFLICTO_UMBRAL_KG,
  type FilaPesoCuerpo,
  type FilaPesoBiometrica,
} from './peso.ts';

const CUERPO: FilaPesoCuerpo[] = [
  { fecha: '2026-08-22', peso_kg: 82.4, source: 'manual', created_at: '2026-08-22T12:00:00Z' },
  { fecha: '2026-08-20', peso_kg: 82.9, source: 'renpho', created_at: '2026-08-20T12:00:00Z' },
];

const BIO: FilaPesoBiometrica[] = [
  { fecha: '2026-08-22', peso_kg: 83.1, fuente: 'google_health' },
  { fecha: '2026-08-21', peso_kg: 82.7, fuente: 'google_health' },
];

test('pesoDelDia: cuerpo_log le gana a biometricas_dia el mismo dia', () => {
  const r = pesoDelDia('2026-08-22', CUERPO, BIO);
  assert.equal(r?.peso_kg, 82.4);
  assert.equal(r?.origen, 'cuerpo_log');
  assert.equal(r?.fuente, 'manual');
  assert.equal(r?.peso_alterno_kg, 83.1);
  assert.equal(r?.diff_kg, -0.7);
  assert.equal(r?.hay_conflicto, true);
});

test('pesoDelDia: cae a biometricas_dia cuando no hay medicion propia', () => {
  const r = pesoDelDia('2026-08-21', CUERPO, BIO);
  assert.equal(r?.peso_kg, 82.7);
  assert.equal(r?.origen, 'biometricas_dia');
  assert.equal(r?.fuente, 'google_health');
  assert.equal(r?.peso_alterno_kg, null);
  assert.equal(r?.diff_kg, null);
  assert.equal(r?.hay_conflicto, false);
});

test('pesoDelDia: sin dato en ninguna tabla devuelve null, no inventa', () => {
  assert.equal(pesoDelDia('2026-08-19', CUERPO, BIO), null);
});

test('pesoDelDia: cuerpo_log sin peso (solo cintura o sueno) no bloquea el fallback', () => {
  const soloSueno: FilaPesoCuerpo[] = [{ fecha: '2026-08-21', peso_kg: null, source: 'manual' }];
  const r = pesoDelDia('2026-08-21', soloSueno, BIO);
  assert.equal(r?.origen, 'biometricas_dia');
  assert.equal(r?.peso_kg, 82.7);
});

test('pesoDelDia: peso 0 o negativo es basura, no medicion', () => {
  const basura: FilaPesoCuerpo[] = [{ fecha: '2026-08-21', peso_kg: 0, source: 'manual' }];
  assert.equal(pesoDelDia('2026-08-21', basura, BIO)?.origen, 'biometricas_dia');
  const negativa: FilaPesoCuerpo[] = [{ fecha: '2026-08-21', peso_kg: -5, source: 'manual' }];
  assert.equal(pesoDelDia('2026-08-21', negativa, BIO)?.origen, 'biometricas_dia');
});

test('pesoDelDia: acepta numeric de Supabase que llega como string', () => {
  const strings: FilaPesoCuerpo[] = [{ fecha: '2026-08-21', peso_kg: '81.5', source: 'manual' }];
  const r = pesoDelDia('2026-08-21', strings, BIO);
  assert.equal(r?.peso_kg, 81.5);
  assert.equal(r?.origen, 'cuerpo_log');
});

test('pesoDelDia: varias mediciones el mismo dia, gana la mas reciente', () => {
  const dobles: FilaPesoCuerpo[] = [
    { fecha: '2026-08-22', peso_kg: 83.0, source: 'renpho', created_at: '2026-08-22T07:00:00Z' },
    { fecha: '2026-08-22', peso_kg: 82.4, source: 'manual', updated_at: '2026-08-22T21:00:00Z' },
  ];
  assert.equal(pesoDelDia('2026-08-22', dobles, [])?.peso_kg, 82.4);
});

test('pesoDelDia: sin timestamps gana la ultima fila del arreglo', () => {
  const sinFecha: FilaPesoCuerpo[] = [
    { fecha: '2026-08-22', peso_kg: 83.0, source: 'renpho' },
    { fecha: '2026-08-22', peso_kg: 82.4, source: 'manual' },
  ];
  assert.equal(pesoDelDia('2026-08-22', sinFecha, [])?.peso_kg, 82.4);
});

test('pesoDelDia: una fila fechada le gana a una sin timestamp aunque venga despues', () => {
  const mixtas: FilaPesoCuerpo[] = [
    { fecha: '2026-08-22', peso_kg: 82.4, source: 'manual', updated_at: '2026-08-22T21:00:00Z' },
    { fecha: '2026-08-22', peso_kg: 90.0, source: 'renpho' },
  ];
  assert.equal(pesoDelDia('2026-08-22', mixtas, [])?.peso_kg, 82.4);
});

test('hay_conflicto: diferencia bajo el umbral es ruido de balanza', () => {
  const cuerpo: FilaPesoCuerpo[] = [{ fecha: '2026-08-22', peso_kg: 82.4, source: 'manual' }];
  const bio: FilaPesoBiometrica[] = [{ fecha: '2026-08-22', peso_kg: 82.5, fuente: 'google_health' }];
  const r = pesoDelDia('2026-08-22', cuerpo, bio);
  assert.equal(r?.hay_conflicto, false);
  assert.equal(r?.diff_kg, -0.1);
});

test('hay_conflicto: exactamente el umbral ya cuenta como conflicto', () => {
  const cuerpo: FilaPesoCuerpo[] = [{ fecha: '2026-08-22', peso_kg: 82.4, source: 'manual' }];
  const bio: FilaPesoBiometrica[] = [
    { fecha: '2026-08-22', peso_kg: 82.4 + CONFLICTO_UMBRAL_KG, fuente: 'google_health' },
  ];
  assert.equal(pesoDelDia('2026-08-22', cuerpo, bio)?.hay_conflicto, true);
});

test('serieDePeso: une las dos tablas sin huecos y ordena desc', () => {
  const serie = serieDePeso(CUERPO, BIO);
  assert.deepEqual(serie.map((p) => p.fecha), ['2026-08-22', '2026-08-21', '2026-08-20']);
  assert.deepEqual(serie.map((p) => p.origen), ['cuerpo_log', 'biometricas_dia', 'cuerpo_log']);
});

test('serieDePeso: sin datos devuelve arreglo vacio', () => {
  assert.deepEqual(serieDePeso([], []), []);
});

test('conflictosDePeso: aisla los dias donde las dos fuentes se pelean', () => {
  const conflictos = conflictosDePeso(serieDePeso(CUERPO, BIO));
  assert.equal(conflictos.length, 1);
  assert.equal(conflictos[0].fecha, '2026-08-22');
});

test('ultimoPesoConocido: usa el dato de hoy con dias_atras 0', () => {
  const r = ultimoPesoConocido('2026-08-22', CUERPO, BIO);
  assert.equal(r?.peso_kg, 82.4);
  assert.equal(r?.dias_atras, 0);
});

test('ultimoPesoConocido: sin peso hoy retrocede y reporta la antiguedad', () => {
  const r = ultimoPesoConocido('2026-08-25', CUERPO, BIO);
  assert.equal(r?.fecha, '2026-08-22');
  assert.equal(r?.dias_atras, 3);
});

test('ultimoPesoConocido: ignora fechas futuras', () => {
  const r = ultimoPesoConocido('2026-08-21', CUERPO, BIO);
  assert.equal(r?.fecha, '2026-08-21');
  assert.equal(r?.origen, 'biometricas_dia');
});

test('ultimoPesoConocido: sin ningun dato devuelve null', () => {
  assert.equal(ultimoPesoConocido('2026-08-22', [], []), null);
});
