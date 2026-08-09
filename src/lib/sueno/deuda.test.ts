import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularDeuda,
  necesidadEstimada,
  nivelDeuda,
  restarDias,
  formatearHoras,
  TOPE_NOCHES,
  type NocheSueno,
} from './deuda.ts';

const HOY = '2026-08-06';

/** Genera n noches consecutivas terminando en `hasta`, todas de `horas`. */
function noches(hasta: string, n: number, horas: number): NocheSueno[] {
  return Array.from({ length: n }, (_, i) => ({ fecha: restarDias(hasta, i), minutos: horas * 60 }));
}

test('restarDias: cruza mes y ano sin desfase de zona horaria', () => {
  assert.equal(restarDias('2026-08-06', 6), '2026-07-31');
  assert.equal(restarDias('2026-01-01', 1), '2025-12-31');
  assert.equal(restarDias('2026-03-01', 1), '2026-02-28');
});

test('calcularDeuda: dormir la necesidad exacta no genera deuda', () => {
  const r = calcularDeuda(noches(HOY, 14, 8), 8, HOY);
  assert.equal(r.horas, 0);
  assert.equal(r.nivel, 'saldada');
  assert.equal(r.diasSinDato, 0);
  assert.equal(r.promedioHoras, 8);
});

test('calcularDeuda: acumula el deficit de cada noche', () => {
  const r = calcularDeuda(noches(HOY, 14, 7), 8, HOY);
  assert.equal(r.horas, 14); // 1 h x 14 noches
  assert.equal(r.noches, 1.75);
  assert.equal(r.nivel, 'alta');
});

test('calcularDeuda: dormir de mas PAGA deuda', () => {
  const base = [...noches(HOY, 3, 6)]; // -6 h
  const conRecuperacion = [...base, ...noches(restarDias(HOY, 3), 2, 10)]; // +4 h
  assert.equal(calcularDeuda(base, 8, HOY).horas, 6);
  assert.equal(calcularDeuda(conRecuperacion, 8, HOY).horas, 2);
});

test('calcularDeuda: no baja de cero por mucho que se duerma', () => {
  const r = calcularDeuda(noches(HOY, 14, 10), 8, HOY);
  assert.equal(r.horas, 0);
});

test('calcularDeuda: se recorta al tope y lo avisa', () => {
  const r = calcularDeuda(noches(HOY, 14, 4), 8, HOY);
  assert.equal(r.tope, 8 * TOPE_NOCHES);
  assert.equal(r.horas, 20);
  assert.equal(r.topeAlcanzado, true);
});

test('calcularDeuda: solo mira la ventana movil', () => {
  const viejas = noches(restarDias(HOY, 20), 5, 3); // fuera de los 14 dias
  const r = calcularDeuda([...noches(HOY, 14, 8), ...viejas], 8, HOY);
  assert.equal(r.horas, 0);
  assert.equal(r.dias.length, 14);
});

test('calcularDeuda: los dias sin dato son neutros y se reportan', () => {
  const r = calcularDeuda(noches(HOY, 4, 6), 8, HOY);
  assert.equal(r.diasSinDato, 10);
  assert.equal(r.horas, 8); // solo los 4 dias con dato pesan
  assert.equal(r.promedioHoras, 6);
});

test('calcularDeuda: varias sesiones del mismo dia se suman (siesta)', () => {
  const r = calcularDeuda(
    [
      { fecha: HOY, minutos: 6 * 60 },
      { fecha: HOY, minutos: 30 },
    ],
    8,
    HOY,
  );
  const hoy = r.dias[r.dias.length - 1];
  assert.equal(hoy.horas, 6.5);
  assert.equal(hoy.delta, -1.5);
});

test('calcularDeuda: ignora entradas corruptas', () => {
  const r = calcularDeuda(
    [{ fecha: HOY, minutos: 8 * 60 }, { fecha: '', minutos: 100 }, { fecha: HOY, minutos: NaN } as NocheSueno],
    8,
    HOY,
  );
  assert.equal(r.dias[r.dias.length - 1].horas, 8);
});

test('nivelDeuda: cortes relativos a la necesidad', () => {
  assert.equal(nivelDeuda(1, 8), 'saldada');
  assert.equal(nivelDeuda(3, 8), 'baja');
  assert.equal(nivelDeuda(7, 8), 'media');
  assert.equal(nivelDeuda(12, 8), 'alta');
});

test('necesidadEstimada: null sin historico suficiente', () => {
  assert.equal(necesidadEstimada(noches(HOY, 5, 8)), null);
});

test('necesidadEstimada: usa el percentil alto, no el promedio', () => {
  // 25 noches cortas de deuda cronica + 5 noches libres de 9 h.
  const historial = [...noches(HOY, 25, 6), ...noches(restarDias(HOY, 25), 5, 9)];
  const n = necesidadEstimada(historial);
  assert.ok(n !== null);
  assert.ok(n! >= 8.5, `el promedio (6.5) no debe mandar; devolvio ${n}`);
});

test('necesidadEstimada: acota a [6, 10] y descarta outliers', () => {
  assert.equal(necesidadEstimada(noches(HOY, 20, 13)), 10);
  assert.equal(necesidadEstimada(noches(HOY, 20, 4)), 6);
  // Una noche de 20 h (dato roto) no debe arrastrar la estimacion.
  const conBasura = [...noches(HOY, 20, 7.5), { fecha: restarDias(HOY, 30), minutos: 20 * 60 }];
  assert.equal(necesidadEstimada(conBasura), 7.5);
});

test('formatearHoras: horas y minutos legibles', () => {
  assert.equal(formatearHoras(7.5), '7 h 30 min');
  assert.equal(formatearHoras(8), '8 h');
  assert.equal(formatearHoras(0.5), '30 min');
  assert.equal(formatearHoras(-1.25), '-1 h 15 min');
  assert.equal(formatearHoras(1.999), '2 h');
});
