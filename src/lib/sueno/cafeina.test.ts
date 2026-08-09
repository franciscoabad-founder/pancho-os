import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mgActivos,
  curvaCafeina,
  horaCorte,
  horasHastaLimpio,
  totalDelDia,
  BEBIDAS,
  VIDA_MEDIA_DEFAULT_H,
  UMBRAL_DORMIR_MG,
} from './cafeina.ts';

const H = 3_600_000;
const T0 = Date.UTC(2026, 7, 6, 13, 0, 0); // 08:00 en Guayaquil

test('mgActivos: una vida media deja la mitad', () => {
  const dosis = [{ tomadoMs: T0, mg: 200 }];
  assert.equal(mgActivos(dosis, T0), 200);
  assert.equal(mgActivos(dosis, T0 + VIDA_MEDIA_DEFAULT_H * H), 100);
  assert.equal(mgActivos(dosis, T0 + 2 * VIDA_MEDIA_DEFAULT_H * H), 50);
});

test('mgActivos: las dosis se suman', () => {
  const dosis = [
    { tomadoMs: T0, mg: 100 },
    { tomadoMs: T0 + VIDA_MEDIA_DEFAULT_H * H, mg: 100 },
  ];
  assert.equal(mgActivos(dosis, T0 + VIDA_MEDIA_DEFAULT_H * H), 150);
});

test('mgActivos: las dosis futuras y las corruptas no cuentan', () => {
  const dosis = [
    { tomadoMs: T0 + 3 * H, mg: 200 },
    { tomadoMs: T0, mg: -50 },
    { tomadoMs: NaN, mg: 100 },
  ];
  assert.equal(mgActivos(dosis, T0), 0);
});

test('mgActivos: vida media mas larga deja mas cafeina activa', () => {
  const dosis = [{ tomadoMs: T0, mg: 200 }];
  const rapido = mgActivos(dosis, T0 + 8 * H, 4);
  const lento = mgActivos(dosis, T0 + 8 * H, 9);
  assert.ok(lento > rapido * 1.5);
});

test('curvaCafeina: monotona decreciente sin dosis nuevas', () => {
  const pts = curvaCafeina([{ tomadoMs: T0, mg: 150 }], T0, T0 + 12 * H);
  assert.ok(pts.length > 40);
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i].mg <= pts[i - 1].mg);
  assert.equal(pts[0].mg, 150);
});

test('horaCorte: la resuelve por decaimiento inverso', () => {
  const dormir = T0 + 15 * H; // 23:00
  const corte = horaCorte([], dormir, 100, UMBRAL_DORMIR_MG)!;
  // De 100 mg a 50 mg = exactamente una vida media antes de dormir.
  assert.ok(Math.abs(corte - (dormir - VIDA_MEDIA_DEFAULT_H * H)) < 60_000);
});

test('horaCorte: descuenta lo que ya hay en el cuerpo', () => {
  const dormir = T0 + 15 * H;
  const sinNada = horaCorte([], dormir, 100)!;
  const conCafe = horaCorte([{ tomadoMs: T0 + 10 * H, mg: 120 }], dormir, 100)!;
  assert.ok(conCafe < sinNada, 'con cafeina previa el corte debe ser mas temprano');
});

test('horaCorte: null si el umbral ya no se alcanza ni tomando cero', () => {
  const dormir = T0 + 3 * H;
  assert.equal(horaCorte([{ tomadoMs: T0, mg: 300 }], dormir, 100), null);
});

test('horaCorte: dosis pequena cabe a cualquier hora', () => {
  const dormir = T0 + 15 * H;
  assert.equal(horaCorte([], dormir, 20), dormir);
});

test('horasHastaLimpio: cero si ya esta por debajo del umbral', () => {
  assert.equal(horasHastaLimpio([{ tomadoMs: T0, mg: 30 }], T0), 0);
});

test('horasHastaLimpio: coherente con la vida media', () => {
  const h = horasHastaLimpio([{ tomadoMs: T0, mg: 200 }], T0, 50);
  // 200 -> 50 mg son dos vidas medias (11.4 h), con resolucion de 15 min.
  assert.ok(Math.abs(h - 2 * VIDA_MEDIA_DEFAULT_H) <= 0.25, `devolvio ${h}`);
});

test('totalDelDia: suma y descarta negativos', () => {
  assert.equal(totalDelDia([{ tomadoMs: T0, mg: 95 }, { tomadoMs: T0, mg: 63 }, { tomadoMs: T0, mg: -5 }]), 158);
});

test('BEBIDAS: catalogo con claves unicas y mg positivos', () => {
  const keys = new Set(BEBIDAS.map((b) => b.key));
  assert.equal(keys.size, BEBIDAS.length);
  for (const b of BEBIDAS) assert.ok(b.mg > 0 && b.nombre.length > 2);
});
