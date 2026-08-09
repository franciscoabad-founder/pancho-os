import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirEstado, horaDecimal, type ConfigSueno, type FilaSesion } from './estado.ts';
import { restarDias } from './deuda.ts';
import { msDeHoraLocal } from './modelo.ts';

const HOY = '2026-08-06';
const AHORA = msDeHoraLocal(HOY, 11); // 11:00 hora Guayaquil

const CONFIG: ConfigSueno = {
  necesidad_h: 8,
  necesidad_auto: false,
  hora_dormir: '23:00:00',
  hora_despertar: '07:00:00',
  deuda_objetivo_h: 2,
  siestas_ok: true,
  cafeina_vida_media_h: 5.7,
  cafeina_umbral_mg: 50,
};

/** Noche que termina el dia `fecha` a las `despertar`, de `horas` de duracion. */
function noche(fecha: string, horas: number, despertar = 7, i = 0): FilaSesion {
  const finMs = msDeHoraLocal(fecha, despertar);
  return {
    id: `s-${fecha}-${i}`,
    fecha,
    inicio: new Date(finMs - horas * 3_600_000).toISOString(),
    fin: new Date(finMs).toISOString(),
    minutos: Math.round(horas * 60),
    siesta: false,
    calidad: null,
    fuente: 'manual',
    notas: null,
  };
}

function historial(horasPorNoche: number, dias = 14, hasta = HOY): FilaSesion[] {
  return Array.from({ length: dias }, (_, i) => noche(restarDias(hasta, i), horasPorNoche, 7, i));
}

function estado(sesiones: FilaSesion[], extra: Partial<Parameters<typeof construirEstado>[0]> = {}) {
  return construirEstado({
    hoy: HOY,
    ahoraMs: AHORA,
    config: CONFIG,
    sesiones,
    biometricas: [],
    dosis: [],
    ...extra,
  });
}

test('horaDecimal: parsea time de Postgres y cae al respaldo', () => {
  assert.equal(horaDecimal('23:00:00', 0), 23);
  assert.equal(horaDecimal('07:30', 0), 7.5);
  assert.equal(horaDecimal(null, 6.5), 6.5);
  assert.equal(horaDecimal('no-es-hora', 6.5), 6.5);
});

test('construirEstado: dormir la necesidad deja la deuda saldada y sin plan de pago', () => {
  const e = estado(historial(8));
  assert.equal(e.deuda.horas, 0);
  assert.equal(e.deuda.nivel, 'saldada');
  assert.equal(e.plan.noches.length, 0);
  assert.ok(e.resumen.includes('bajo control'));
  assert.equal(e.siesta, null, 'sin deuda no se recomienda siesta');
});

test('construirEstado: deficit cronico produce deuda, plan y horario adelantado', () => {
  const e = estado(historial(6));
  assert.equal(e.deuda.horas, 20, '2 h x 14 noches, recortado al tope de 20 h');
  assert.ok(e.deuda.topeAlcanzado);
  assert.ok(e.plan.noches.length > 0);
  assert.equal(e.plan.horarioHoy.acostarse, '22:15');
  assert.ok(e.siesta, 'con deuda alta si se recomienda siesta');
  assert.ok(e.plan.acciones.some((a) => a.key === 'siesta'));
});

test('construirEstado: la deuda hunde la curva del dia', () => {
  const descansado = estado(historial(8));
  const endeudado = estado(historial(6));
  const pico = (e: typeof descansado) => Math.max(...e.curva.map((p) => p.alerta));
  assert.ok(pico(endeudado) < pico(descansado) - 3, 'el pico con deuda debe verse mas bajo');
  assert.ok(endeudado.anclas.s_inicial > descansado.anclas.s_inicial);
});

test('construirEstado: las seis ventanas salen y "ahora" cae en alguna', () => {
  const e = estado(historial(8));
  assert.equal(e.ventanas.length, 6);
  assert.ok(e.ahora, 'a las 11:00 el punto actual debe existir');
  assert.ok(e.ahora!.alerta > 0);
  assert.ok(['pico_manana', 'inercia', null].includes(e.ahora!.ventana as string));
});

test('construirEstado: el despertar real de hoy manda sobre el configurado', () => {
  const conHoy = estado([...historial(8), noche(HOY, 7, 9.5, 99)]);
  assert.equal(conHoy.anclas.despertar_real, true);
  assert.equal(conHoy.anclas.hora_despertar, 9.5);
  assert.equal(conHoy.ventanas[0].etiqueta, '09:30 a 11:00');
  // Con el despertar corrido, el Tmin (y todo el Proceso C) se corre con el.
  assert.equal(conHoy.anclas.tmin, 7.5);
});

test('construirEstado: sin ningun registro no inventa una catastrofe', () => {
  const e = estado([]);
  assert.equal(e.deuda.horas, 0);
  assert.equal(e.deuda.diasSinDato, 14);
  assert.ok(e.plan.acciones.some((a) => a.key === 'registrar'), 'debe avisar que faltan registros');
  const pico = Math.max(...e.curva.map((p) => p.alerta));
  assert.ok(pico > 50, `sin datos la curva no puede estar en el piso; pico ${pico}`);
});

test('construirEstado: biometricas_dia rellena los dias sin sesion', () => {
  const soloBio = estado([], {
    biometricas: Array.from({ length: 14 }, (_, i) => ({ fecha: restarDias(HOY, i), sueno_min: 6 * 60 })),
  });
  assert.equal(soloBio.deuda.diasSinDato, 0);
  assert.equal(soloBio.deuda.horas, 20);
});

test('construirEstado: la sesion gana sobre biometricas del mismo dia', () => {
  const e = estado([noche(HOY, 8)], {
    biometricas: [{ fecha: HOY, sueno_min: 3 * 60 }],
  });
  const hoy = e.deuda.dias[e.deuda.dias.length - 1];
  assert.equal(hoy.horas, 8);
});

test('construirEstado: necesidad_auto estima desde el historico', () => {
  const e = estado(historial(9, 20), { config: { ...CONFIG, necesidad_auto: true } });
  assert.equal(e.necesidad.origen, 'auto');
  assert.equal(e.necesidad.horas, 9);
  assert.equal(e.deuda.horas, 0, 'si duerme 9 h y esa es su necesidad, no hay deuda');
});

test('construirEstado: sin historico suficiente la necesidad cae a la configurada', () => {
  const e = estado(historial(9, 5), { config: { ...CONFIG, necesidad_auto: true } });
  assert.equal(e.necesidad.origen, 'config');
  assert.equal(e.necesidad.horas, 8);
});

test('construirEstado: la cafeina de la tarde adelanta el corte y suena la alarma', () => {
  const dosis = [
    { id: 'c1', fecha: HOY, tomado_at: new Date(msDeHoraLocal(HOY, 8)).toISOString(), mg: 120, bebida: 'americano' },
    { id: 'c2', fecha: HOY, tomado_at: new Date(msDeHoraLocal(HOY, 17)).toISOString(), mg: 120, bebida: 'americano' },
  ];
  const e = estado(historial(8), { dosis });
  assert.equal(e.cafeina.total_hoy_mg, 240);
  assert.ok(e.cafeina.mg_al_dormir > e.cafeina.umbral_mg, 'a las 23:00 sigue por encima del umbral');
  assert.equal(e.cafeina.hora_corte, null, 'ya no hay hora segura para otro cafe');
  assert.ok(!e.plan.acciones.some((a) => a.key === 'cafeina'), 'sin hora de corte no se inventa la accion');
});

test('construirEstado: sin cafeina previa el corte cae en la tarde', () => {
  const e = estado(historial(8));
  assert.ok(e.cafeina.hora_corte !== null);
  assert.ok(e.cafeina.hora_corte! > 15 && e.cafeina.hora_corte! < 19, `corte en ${e.cafeina.hora_corte}`);
  assert.equal(e.cafeina.mg_ahora, 0);
});

test('construirEstado: una siesta registrada hoy levanta la curva de la tarde', () => {
  const base = historial(6);
  const siestaMs = msDeHoraLocal(HOY, 15);
  const conSiesta = estado([
    ...base,
    {
      ...noche(HOY, 0.5, 15.5, 77),
      siesta: true,
      inicio: new Date(siestaMs).toISOString(),
      fin: new Date(siestaMs + 30 * 60_000).toISOString(),
      minutos: 30,
    },
  ]);
  const sin = estado(base);
  const alerta = (e: typeof sin, hora: number) => e.curva.find((p) => Math.abs(p.hora - hora) < 0.01)!.alerta;
  assert.ok(alerta(conSiesta, 18) > alerta(sin, 18));
});

test('construirEstado: turno nocturno (despertar tarde, dormir pasada medianoche)', () => {
  const nocturno: ConfigSueno = { ...CONFIG, hora_despertar: '14:00:00', hora_dormir: '05:00:00' };
  const e = estado(
    Array.from({ length: 14 }, (_, i) => noche(restarDias(HOY, i), 7, 14, i)),
    { config: nocturno },
  );
  assert.equal(e.anclas.hora_despertar, 14);
  assert.equal(e.anclas.tmin, 12);
  const sueno = e.ventanas.find((v) => v.clave === 'sueno')!;
  assert.ok(sueno.desde > 24, 'la ventana de sueno cae despues de medianoche');
  assert.equal(sueno.etiqueta, '04:30 a 06:00');
  for (const v of e.ventanas) assert.ok(v.hasta > v.desde);
});

test('construirEstado: el payload trae todo lo que el UI consume', () => {
  const e = estado(historial(7));
  for (const clave of ['hoy', 'config', 'necesidad', 'deuda', 'anclas', 'curva', 'ventanas', 'cafeina', 'sesiones', 'plan', 'resumen'] as const) {
    assert.ok(e[clave] !== undefined, `falta ${clave} en el payload`);
  }
  assert.ok(e.curva.length > 30);
  assert.equal(e.deuda.dias.length, 14);
  assert.ok(e.sesiones.length <= 14, 'el historial devuelto se acota a 14 dias');
  assert.ok(e.sesiones[0].fecha >= e.sesiones[e.sesiones.length - 1].fecha, 'ordenado de mas reciente a mas viejo');
});
