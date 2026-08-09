import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sVigilia,
  sSueno,
  sEquilibrioAlDespertar,
  simularS,
  procesoC,
  tminDesdeDespertar,
  inercia,
  escalarAlerta,
  curvaDelDia,
  horaLocal,
  msDeHoraLocal,
  formatearHora,
  TAU_VIGILIA,
  TAU_SUENO,
} from './modelo.ts';

const H = 3_600_000;

test('sVigilia: sube hacia 1 y respeta la constante de tiempo', () => {
  assert.equal(sVigilia(0.2, 0), 0.2);
  // tras una tau, cubre el 63.2% de lo que falta para 1
  const esperado = 1 - (1 - 0.2) * Math.exp(-1);
  assert.ok(Math.abs(sVigilia(0.2, TAU_VIGILIA) - esperado) < 1e-12);
  assert.ok(sVigilia(0.2, 100) > 0.99);
  assert.ok(sVigilia(0.2, 3) > 0.2);
});

test('sSueno: baja hacia 0 con tau corta', () => {
  assert.equal(sSueno(0.6, 0), 0.6);
  assert.ok(Math.abs(sSueno(0.6, TAU_SUENO) - 0.6 * Math.exp(-1)) < 1e-12);
  assert.ok(sSueno(0.6, 8) < 0.15);
});

test('sEquilibrioAlDespertar: dormir menos deja mas presion al despertar', () => {
  const ocho = sEquilibrioAlDespertar(8);
  const seis = sEquilibrioAlDespertar(6);
  const nueve = sEquilibrioAlDespertar(9);
  assert.ok(seis > ocho, 'seis horas deja mas S que ocho');
  assert.ok(nueve < ocho, 'nueve horas deja menos S que ocho');
  assert.ok(ocho > 0 && ocho < 0.3);
});

test('simularS: un rango sin episodios es vigilia pura', () => {
  const t0 = Date.UTC(2026, 7, 6, 12, 0, 0);
  const s = simularS([], t0, t0 + 5 * H, 0.1);
  assert.ok(Math.abs(s - sVigilia(0.1, 5)) < 1e-12);
});

test('simularS: alterna vigilia y sueno respetando el orden', () => {
  const t0 = Date.UTC(2026, 7, 6, 12, 0, 0);
  const episodios = [{ inicioMs: t0 + 2 * H, finMs: t0 + 4 * H }];
  const s = simularS(episodios, t0, t0 + 6 * H, 0.1);
  const manual = sVigilia(sSueno(sVigilia(0.1, 2), 2), 2);
  assert.ok(Math.abs(s - manual) < 1e-12);
});

test('simularS: recorta episodios fuera del rango y tolera desorden', () => {
  const t0 = Date.UTC(2026, 7, 6, 12, 0, 0);
  const episodios = [
    { inicioMs: t0 + 5 * H, finMs: t0 + 7 * H }, // se recorta en t0+6h
    { inicioMs: t0 - 3 * H, finMs: t0 - 1 * H }, // anterior al rango, se ignora
  ];
  const s = simularS(episodios, t0, t0 + 6 * H, 0.5);
  const manual = sSueno(sVigilia(0.5, 5), 1);
  assert.ok(Math.abs(s - manual) < 1e-12);
});

test('simularS: episodio invalido (fin antes de inicio) se descarta', () => {
  const t0 = Date.UTC(2026, 7, 6, 12, 0, 0);
  const s = simularS([{ inicioMs: t0 + 3 * H, finMs: t0 + 1 * H }], t0, t0 + 4 * H, 0.2);
  assert.ok(Math.abs(s - sVigilia(0.2, 4)) < 1e-12);
});

test('procesoC: normalizado a 0-1 con el valle en la franja del Tmin', () => {
  const tmin = 5;
  let peor = Infinity;
  let horaPeor = -1;
  for (let h = 0; h < 24; h += 0.05) {
    const c = procesoC(h, tmin);
    assert.ok(c >= -1e-9 && c <= 1 + 1e-9, `c fuera de rango en ${h}: ${c}`);
    if (c < peor) { peor = c; horaPeor = h; }
  }
  // El segundo armonico corre el valle compuesto hasta ~1 h antes del Tmin (ver
  // el comentario de cCruda). Debe seguir cayendo en la franja de madrugada.
  assert.ok(horaPeor >= tmin - 1.5 && horaPeor <= tmin + 0.5, `valle en ${horaPeor}, fuera de la franja del Tmin`);
});

test('procesoC: el perfil se corre con el Tmin (cronotipo)', () => {
  // Alguien con Tmin 2 h mas tarde tiene el mismo valor 2 h despues.
  assert.ok(Math.abs(procesoC(14, 5) - procesoC(16, 7)) < 1e-12);
});

test('tminDesdeDespertar: 2 h antes, envolviendo la medianoche', () => {
  assert.equal(tminDesdeDespertar(7), 5);
  assert.equal(tminDesdeDespertar(1), 23);
});

test('inercia: maxima al despertar y despreciable a las 3 horas', () => {
  assert.ok(Math.abs(inercia(0) - 0.35) < 1e-12);
  assert.ok(inercia(45) < inercia(0));
  assert.ok(inercia(180) < 0.01);
  assert.equal(inercia(-10), 0);
});

test('escalarAlerta: recorta a 0-100 con la ventana fija', () => {
  assert.equal(escalarAlerta(-5), 0);
  assert.equal(escalarAlerta(5), 100);
  assert.ok(escalarAlerta(0.1) > escalarAlerta(-0.1));
});

// ── Curva del dia: los anclajes empiricos que el modelo debe reproducir ──────

function curvaBase(sInicial: number) {
  const despertarMs = Date.UTC(2026, 7, 6, 12, 0, 0); // 07:00 en Guayaquil
  return {
    despertarMs,
    curva: curvaDelDia({
      desdeMs: despertarMs,
      hastaMs: despertarMs + 16 * H,
      sInicial,
      horaDespertar: 7,
      tminHora: 5,
      pasoMin: 5,
    }),
  };
}

test('curvaDelDia: reproduce inercia, pico matutino, bajon y segundo aire', () => {
  const { curva } = curvaBase(sEquilibrioAlDespertar(8));

  const alDespertar = curva[0].alerta;
  const aLaHora = curva.find((p) => Math.abs(p.hora - 8) < 0.01)!.alerta;
  assert.ok(aLaHora > alDespertar, 'la inercia debe disiparse durante la primera hora');

  const enRango = (d: number, h: number) => curva.filter((p) => p.hora >= d && p.hora <= h);
  const maxEn = (d: number, h: number) => enRango(d, h).reduce((b, p) => (p.alerta > b.alerta ? p : b));
  const minEn = (d: number, h: number) => enRango(d, h).reduce((b, p) => (p.alerta < b.alerta ? p : b));

  const pico = maxEn(8.5, 14);
  assert.ok(pico.hora - 7 >= 3 && pico.hora - 7 <= 5.5, `pico matutino fuera de 3-5.5 h: ${pico.hora}`);

  const bajon = minEn(pico.hora + 0.5, 18);
  assert.ok(bajon.hora - 7 >= 6.5 && bajon.hora - 7 <= 9.5, `bajon fuera de 6.5-9.5 h: ${bajon.hora}`);
  assert.ok(bajon.alerta < pico.alerta);

  const aire = maxEn(bajon.hora + 0.5, 21.5);
  assert.ok(aire.hora - 7 >= 11 && aire.hora - 7 <= 14.5, `segundo aire fuera de 11-14.5 h: ${aire.hora}`);
  assert.ok(aire.alerta > bajon.alerta, 'el segundo aire debe levantar respecto del bajon');
  assert.ok(aire.alerta <= pico.alerta, 'el segundo aire no debe superar al pico matutino');

  const nocheTarde = curva[curva.length - 1].alerta;
  assert.ok(nocheTarde < aire.alerta, 'la alerta debe caer al acercarse la hora de dormir');
});

test('curvaDelDia: mas deuda hunde toda la curva, no solo un punto', () => {
  const descansado = curvaBase(sEquilibrioAlDespertar(8)).curva;
  const endeudado = curvaBase(sEquilibrioAlDespertar(5.5)).curva;
  assert.equal(descansado.length, endeudado.length);
  for (let i = 0; i < descansado.length; i++) {
    assert.ok(
      endeudado[i].alerta <= descansado[i].alerta,
      `punto ${i}: la curva con deuda no deberia estar por encima`,
    );
  }
  const maxD = Math.max(...descansado.map((p) => p.alerta));
  const maxE = Math.max(...endeudado.map((p) => p.alerta));
  assert.ok(maxD - maxE > 3, 'la diferencia de pico deberia ser visible');
});

test('curvaDelDia: una siesta en el bajon levanta la tarde', () => {
  const despertarMs = Date.UTC(2026, 7, 6, 12, 0, 0);
  const base = { desdeMs: despertarMs, hastaMs: despertarMs + 14 * H, sInicial: 0.3, horaDespertar: 7, tminHora: 5, pasoMin: 15 };
  const sin = curvaDelDia(base);
  const con = curvaDelDia({
    ...base,
    episodios: [{ inicioMs: despertarMs + 8 * H, finMs: despertarMs + 8.5 * H }],
  });
  const hora = (c: typeof sin, h: number) => c.find((p) => Math.abs(p.hora - h) < 0.01)!.alerta;
  assert.ok(hora(con, 17) > hora(sin, 17), 'despues de la siesta la alerta debe ser mayor');
  assert.equal(hora(con, 12), hora(sin, 12), 'antes de la siesta no debe cambiar nada');
});

test('horaLocal / msDeHoraLocal: ida y vuelta en America/Guayaquil (UTC-5)', () => {
  const ms = msDeHoraLocal('2026-08-06', 7.5);
  assert.equal(new Date(ms).toISOString(), '2026-08-06T12:30:00.000Z');
  assert.ok(Math.abs(horaLocal(ms) - 7.5) < 1e-9);
  assert.ok(Math.abs(horaLocal(msDeHoraLocal('2026-08-06', 23.75)) - 23.75) < 1e-9);
});

test('formatearHora: HH:MM, envuelve pasadas las 24 y redondea el minuto 60', () => {
  assert.equal(formatearHora(7), '07:00');
  assert.equal(formatearHora(23.5), '23:30');
  assert.equal(formatearHora(25.25), '01:15');
  assert.equal(formatearHora(9.999), '10:00');
});
