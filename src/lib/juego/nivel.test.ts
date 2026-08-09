import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpParaNivel, nivelDesdeXp } from './nivel.ts';

test('xpParaNivel: nivel 1 siempre es 0 XP', () => {
  assert.equal(xpParaNivel(1), 0);
  assert.equal(xpParaNivel(0), 0);
  assert.equal(xpParaNivel(-3), 0);
});

test('xpParaNivel: fórmula round(50 * n^1.75) para n >= 2', () => {
  assert.equal(xpParaNivel(2), Math.round(50 * Math.pow(2, 1.75)));
  assert.equal(xpParaNivel(10), Math.round(50 * Math.pow(10, 1.75)));
});

test('xpParaNivel: creciente y monotónico', () => {
  let prev = xpParaNivel(1);
  for (let n = 2; n <= 30; n++) {
    const cur = xpParaNivel(n);
    assert.ok(cur > prev, `xpParaNivel(${n})=${cur} debe ser > xpParaNivel(${n - 1})=${prev}`);
    prev = cur;
  }
});

test('nivelDesdeXp: xp negativo o cero => nivel 1', () => {
  assert.equal(nivelDesdeXp(-100).nivel, 1);
  assert.equal(nivelDesdeXp(0).nivel, 1);
  assert.equal(nivelDesdeXp(-100).progreso, 0);
});

test('nivelDesdeXp: xp exacto en el umbral de un nivel', () => {
  const umbral = xpParaNivel(5);
  const r = nivelDesdeXp(umbral);
  assert.equal(r.nivel, 5);
  assert.equal(r.xpEnNivel, 0);
  assert.equal(r.progreso, 0);
});

test('nivelDesdeXp: progreso a mitad de camino al siguiente nivel', () => {
  const base = xpParaNivel(3);
  const siguiente = xpParaNivel(4);
  const mitad = base + Math.round((siguiente - base) / 2);
  const r = nivelDesdeXp(mitad);
  assert.equal(r.nivel, 3);
  assert.ok(r.progreso > 0.3 && r.progreso < 0.7, `progreso ${r.progreso} debería rondar 0.5`);
});

test('nivelDesdeXp: monotónico (nivel no baja al subir xp) y progreso siempre en [0,1]', () => {
  let prevNivel = 1;
  for (let xp = 0; xp <= 5000; xp += 37) {
    const r = nivelDesdeXp(xp);
    assert.ok(r.nivel >= prevNivel, `nivel debe ser no decreciente en xp=${xp}`);
    assert.ok(r.progreso >= 0 && r.progreso <= 1, `progreso fuera de rango en xp=${xp}: ${r.progreso}`);
    prevNivel = r.nivel;
  }
});

test('nivelDesdeXp: xp muy alto sigue siendo consistente con xpParaNivel', () => {
  const r = nivelDesdeXp(100000);
  assert.ok(xpParaNivel(r.nivel) <= 100000);
  assert.ok(xpParaNivel(r.nivel + 1) > 100000);
});
