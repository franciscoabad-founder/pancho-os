import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_HOURS,
  MEV_SETS,
  multiplicadorIntensidad,
  recoveryHours,
  recoveryPct,
  intensidadPromedio,
  intensidadDeSerie,
  estadoRecuperacion,
  DEFAULT_INTENSIDAD_PCT,
} from './recovery.ts';

test('multiplicadorIntensidad: bandas 0.85 / 1.0 / 1.25', () => {
  assert.equal(multiplicadorIntensidad(50), 0.85);
  assert.equal(multiplicadorIntensidad(64.9), 0.85);
  assert.equal(multiplicadorIntensidad(65), 1.0);
  assert.equal(multiplicadorIntensidad(80), 1.0);
  assert.equal(multiplicadorIntensidad(80.1), 1.25);
  assert.equal(multiplicadorIntensidad(95), 1.25);
});

test('recoveryHours: en MEV exacto, sin exceso de volumen, T = base_hours * mult', () => {
  const mev = MEV_SETS.chest;
  assert.equal(recoveryHours('chest', mev, 70), BASE_HOURS.chest);
});

test('recoveryHours: volumen por encima del MEV sube las horas de recuperación', () => {
  const mev = MEV_SETS.chest;
  const base = recoveryHours('chest', mev, 70);
  const conExceso = recoveryHours('chest', mev * 2, 70);
  assert.ok(conExceso > base);
});

test('recovery curve: t=0 => 0%, t=T => ~95%', () => {
  const T = recoveryHours('chest', MEV_SETS.chest, 70); // = 60h
  assert.equal(recoveryPct(0, T), 0);
  const pctEnT = recoveryPct(T, T);
  assert.ok(pctEnT > 94.5 && pctEnT < 95.5, `esperaba ~95, obtuvo ${pctEnT}`);
});

test('recovery curve: monotonía creciente en el tiempo', () => {
  const T = 60;
  const p1 = recoveryPct(5, T);
  const p2 = recoveryPct(20, T);
  const p3 = recoveryPct(60, T);
  assert.ok(p1 < p2);
  assert.ok(p2 < p3);
});

test('intensidadDeSerie / intensidadPromedio: fallback al default (70) sin 1RM histórico', () => {
  assert.equal(intensidadDeSerie(80, null), DEFAULT_INTENSIDAD_PCT);
  assert.equal(intensidadDeSerie(80, 0), DEFAULT_INTENSIDAD_PCT);
  assert.equal(intensidadDeSerie(null, 100), DEFAULT_INTENSIDAD_PCT);
  assert.equal(intensidadPromedio([]), DEFAULT_INTENSIDAD_PCT);
  assert.equal(intensidadPromedio([null, undefined]), DEFAULT_INTENSIDAD_PCT);
});

test('intensidadDeSerie / intensidadPromedio: calculan % real cuando hay histórico', () => {
  assert.equal(intensidadDeSerie(80, 100), 80);
  assert.equal(intensidadPromedio([80, 90]), 85);
});

test('estadoRecuperacion: sesión única, t=0 => 0% recuperado, horas_restantes ~= T', () => {
  const inicio = new Date('2026-07-10T08:00:00Z');
  const estado = estadoRecuperacion(
    [{ grupo: 'chest', fecha: inicio, workingSets: MEV_SETS.chest, intensidadPct: 70 }],
    inicio,
  );
  assert.equal(estado.chest.rate_pct, 0);
  assert.ok(estado.chest.horas_restantes > 58 && estado.chest.horas_restantes < 61);
});

test('estadoRecuperacion: sesión única, t=T => ~95% recuperado', () => {
  const inicio = new Date('2026-07-10T08:00:00Z');
  const T = recoveryHours('chest', MEV_SETS.chest, 70);
  const hoy = new Date(inicio.getTime() + T * 3_600_000);
  const estado = estadoRecuperacion(
    [{ grupo: 'chest', fecha: inicio, workingSets: MEV_SETS.chest, intensidadPct: 70 }],
    hoy,
  );
  assert.ok(estado.chest.rate_pct > 94 && estado.chest.rate_pct < 96);
});

test('estadoRecuperacion: stacking acumula fatiga (no resetea el reloj)', () => {
  const t0 = new Date('2026-07-10T08:00:00Z');
  const t10 = new Date(t0.getTime() + 10 * 3_600_000); // +10h
  const hoy = new Date(t0.getTime() + 15 * 3_600_000); // +15h desde t0

  const soloUna = estadoRecuperacion(
    [{ grupo: 'chest', fecha: t0, workingSets: MEV_SETS.chest, intensidadPct: 70 }],
    hoy,
  );
  const dosApiladas = estadoRecuperacion(
    [
      { grupo: 'chest', fecha: t0, workingSets: MEV_SETS.chest, intensidadPct: 70 },
      { grupo: 'chest', fecha: t10, workingSets: MEV_SETS.chest, intensidadPct: 70 },
    ],
    hoy,
  );

  // Con dos sesiones apiladas sin recuperación completa entre ellas, el grupo queda
  // más fatigado (rate_pct menor, horas_restantes mayor) que con una sola sesión al
  // mismo momento absoluto.
  assert.ok(dosApiladas.chest.rate_pct <= soloUna.chest.rate_pct);
  assert.ok(dosApiladas.chest.horas_restantes > soloUna.chest.horas_restantes);
});

test('estadoRecuperacion: grupos sin eventos no aparecen en el resultado', () => {
  const estado = estadoRecuperacion([], new Date());
  assert.deepEqual(estado, {});
});
