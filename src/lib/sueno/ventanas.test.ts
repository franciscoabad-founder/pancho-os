import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curvaDelDia, sEquilibrioAlDespertar } from './modelo.ts';
import { ventanasDelDia, ventanaSiesta, INERCIA_MIN, SIESTA_MARGEN_H, type Ventana } from './ventanas.ts';

const H = 3_600_000;
const DESPERTAR_MS = Date.UTC(2026, 7, 6, 12, 0, 0); // 07:00 en Guayaquil

function ventanas(horasSueno = 8): Ventana[] {
  const curva = curvaDelDia({
    desdeMs: DESPERTAR_MS,
    hastaMs: DESPERTAR_MS + 17 * H,
    sInicial: sEquilibrioAlDespertar(horasSueno),
    horaDespertar: 7,
    tminHora: 5,
    pasoMin: 5,
  });
  return ventanasDelDia(curva, { horaDespertar: 7, horaDormir: 23 });
}

const buscar = (vs: Ventana[], clave: Ventana['clave']) => vs.find((v) => v.clave === clave)!;

test('ventanasDelDia: devuelve las seis ventanas en orden cronologico', () => {
  const vs = ventanas();
  assert.deepEqual(
    vs.map((v) => v.clave),
    ['inercia', 'pico_manana', 'bajon_tarde', 'segundo_aire', 'melatonina', 'sueno'],
  );
  for (let i = 1; i < vs.length; i++) {
    assert.ok(vs[i].desde >= vs[i - 1].desde, `la ventana ${vs[i].clave} arranca antes que la anterior`);
  }
});

test('ventanasDelDia: la inercia arranca al despertar y dura lo esperado', () => {
  const inercia = buscar(ventanas(), 'inercia');
  assert.equal(inercia.desde, 7);
  assert.equal(inercia.hasta, 7 + INERCIA_MIN / 60);
  assert.equal(inercia.etiqueta, '07:00 a 08:30');
});

test('ventanasDelDia: el pico cae en la manana y el bajon en la tarde', () => {
  const vs = ventanas();
  const pico = buscar(vs, 'pico_manana');
  const bajon = buscar(vs, 'bajon_tarde');
  assert.ok(pico.pico! >= 10 && pico.pico! <= 12.5, `pico en ${pico.pico}`);
  assert.ok(bajon.pico! >= 13.5 && bajon.pico! <= 16.5, `bajon en ${bajon.pico}`);
  assert.ok(bajon.alerta! < pico.alerta!);
});

test('ventanasDelDia: la ventana de melatonina termina en la hora de dormir', () => {
  const mel = buscar(ventanas(), 'melatonina');
  assert.equal(mel.hasta, 23);
  assert.equal(mel.desde, 21);
  assert.equal(mel.etiqueta, '21:00 a 23:00');
});

test('ventanasDelDia: soporta hora de dormir despues de medianoche', () => {
  const curva = curvaDelDia({
    desdeMs: DESPERTAR_MS,
    hastaMs: DESPERTAR_MS + 19 * H,
    sInicial: 0.15,
    horaDespertar: 7,
    tminHora: 5,
    pasoMin: 10,
  });
  const vs = ventanasDelDia(curva, { horaDespertar: 7, horaDormir: 1 }); // 01:00
  const sueno = buscar(vs, 'sueno');
  assert.equal(sueno.desde, 24.5);
  assert.equal(sueno.etiqueta, '00:30 a 02:00');
});

test('ventanasDelDia: todas traen etiqueta y consejo', () => {
  for (const v of ventanas()) {
    assert.ok(v.etiqueta.includes(' a '), `${v.clave} sin etiqueta de rango`);
    assert.ok(v.queHacer.length > 20, `${v.clave} sin consejo`);
    assert.ok(v.hasta > v.desde, `${v.clave} con rango invertido`);
  }
});

// ── Siesta ──────────────────────────────────────────────────────────────────

const opts = (deudaH: number, permitida = true) => ({ deudaH, horaDormir: 23, horaDespertar: 7, permitida });

test('ventanaSiesta: sin deuda relevante no se recomienda', () => {
  assert.equal(ventanaSiesta(ventanas(), opts(1)), null);
});

test('ventanaSiesta: desactivada por configuracion devuelve null', () => {
  assert.equal(ventanaSiesta(ventanas(), opts(6, false)), null);
});

test('ventanaSiesta: 20 min con deuda media, 90 con deuda alta', () => {
  assert.equal(ventanaSiesta(ventanas(), opts(4))!.minutos, 20);
  assert.equal(ventanaSiesta(ventanas(), opts(9))!.minutos, 90);
});

test('ventanaSiesta: siempre termina con margen antes de dormir', () => {
  for (const deuda of [3, 5, 8, 12]) {
    const s = ventanaSiesta(ventanas(), opts(deuda));
    if (!s) continue;
    assert.ok(s.hasta <= 23 - SIESTA_MARGEN_H + 1e-9, `siesta de ${deuda} h de deuda termina a las ${s.hasta}`);
    assert.ok(Math.abs(s.hasta - s.desde - s.minutos / 60) < 1e-9);
  }
});

test('ventanaSiesta: si el bajon cae tarde, no cabe y devuelve null', () => {
  // Bajon a las 17:00 con hora de dormir 21:00: no hay margen de 7 h.
  const falso: Ventana[] = [
    { clave: 'bajon_tarde', nombre: 'Bajon', desde: 16, hasta: 18, pico: 17, alerta: 40, etiqueta: '', queHacer: '' },
  ];
  assert.equal(ventanaSiesta(falso, { deudaH: 6, horaDormir: 21, horaDespertar: 7, permitida: true }), null);
});
