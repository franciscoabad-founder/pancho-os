import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curvaDelDia, sEquilibrioAlDespertar } from './modelo.ts';
import { ventanasDelDia, ventanaSiesta } from './ventanas.ts';
import {
  planDeuda,
  simularPago,
  resumenPlan,
  MAX_ADELANTO_MIN,
  MAX_ESTIRAR_MIN,
  MAX_NOCHES_PLAN,
  type ParamsPlan,
} from './plan.ts';

const H = 3_600_000;
const HOY = '2026-08-06';
const DESPERTAR_MS = Date.UTC(2026, 7, 6, 12, 0, 0);

function contexto(deudaH: number, opciones: Partial<ParamsPlan> = {}): ParamsPlan {
  const curva = curvaDelDia({
    desdeMs: DESPERTAR_MS,
    hastaMs: DESPERTAR_MS + 17 * H,
    sInicial: sEquilibrioAlDespertar(8),
    horaDespertar: 7,
    tminHora: 5,
    pasoMin: 10,
  });
  const ventanas = ventanasDelDia(curva, { horaDespertar: 7, horaDormir: 23 });
  return {
    deudaH,
    necesidadH: 8,
    objetivoH: 2,
    hoy: HOY,
    horaDormir: 23,
    horaDespertar: 7,
    ventanas,
    siesta: ventanaSiesta(ventanas, { deudaH, horaDormir: 23, horaDespertar: 7, permitida: true }),
    horaCorteCafeina: 14.5,
    ...opciones,
  };
}

// ── simularPago ─────────────────────────────────────────────────────────────

test('simularPago: sin deuda sobre el objetivo no hay noches', () => {
  assert.deepEqual(simularPago({ deudaH: 1, necesidadH: 8, objetivoH: 2, hoy: HOY, siestaMin: 0 }), []);
});

test('simularPago: respeta el techo por noche', () => {
  const noches = simularPago({ deudaH: 12, necesidadH: 8, objetivoH: 2, hoy: HOY, siestaMin: 0 });
  for (const n of noches) {
    assert.ok(n.adelantoMin <= MAX_ADELANTO_MIN, `adelanto ${n.adelantoMin}`);
    assert.ok(n.estirarMin <= MAX_ESTIRAR_MIN, `estiramiento ${n.estirarMin}`);
    assert.ok(n.dormirH <= 8 + (MAX_ADELANTO_MIN + MAX_ESTIRAR_MIN) / 60 + 1e-9);
  }
});

test('simularPago: la deuda baja de forma monotona hasta el objetivo', () => {
  const noches = simularPago({ deudaH: 10, necesidadH: 8, objetivoH: 2, hoy: HOY, siestaMin: 0 });
  assert.ok(noches.length > 1);
  for (let i = 1; i < noches.length; i++) {
    assert.ok(noches[i].deudaRestanteH < noches[i - 1].deudaRestanteH);
  }
  assert.ok(noches[noches.length - 1].deudaRestanteH <= 2);
});

test('simularPago: fechas consecutivas empezando hoy', () => {
  const noches = simularPago({ deudaH: 6, necesidadH: 8, objetivoH: 2, hoy: HOY, siestaMin: 0 });
  assert.equal(noches[0].fecha, HOY);
  assert.equal(noches[1].fecha, '2026-08-07');
});

test('simularPago: la siesta acelera el pago', () => {
  const sin = simularPago({ deudaH: 8, necesidadH: 8, objetivoH: 2, hoy: HOY, siestaMin: 0 });
  const con = simularPago({ deudaH: 8, necesidadH: 8, objetivoH: 2, hoy: HOY, siestaMin: 20 });
  assert.ok(con.length < sin.length);
});

test('simularPago: no se pasa del horizonte aunque la deuda sea enorme', () => {
  const noches = simularPago({ deudaH: 40, necesidadH: 8, objetivoH: 2, hoy: HOY, siestaMin: 0 });
  assert.equal(noches.length, MAX_NOCHES_PLAN);
});

test('simularPago: la ultima noche no sobrepaga', () => {
  const noches = simularPago({ deudaH: 2.4, necesidadH: 8, objetivoH: 2, hoy: HOY, siestaMin: 0 });
  assert.equal(noches.length, 1);
  assert.equal(noches[0].adelantoMin, 24);
  assert.equal(noches[0].estirarMin, 0);
  assert.equal(noches[0].deudaRestanteH, 2);
});

// ── planDeuda ───────────────────────────────────────────────────────────────

test('planDeuda: con deuda alta ordena acostarse antes y da hora concreta', () => {
  const plan = planDeuda(contexto(9));
  assert.equal(plan.nivel, 'media');
  const acostarse = plan.acciones.find((a) => a.key === 'acostarse')!;
  assert.ok(acostarse.titulo.includes('45 min'));
  assert.equal(plan.horarioHoy.acostarse, '22:15');
  assert.equal(plan.horarioHoy.despertar, '07:30');
  assert.ok(plan.nochesParaObjetivo! > 1);
});

test('planDeuda: sin deuda sobre el objetivo el plan es de mantenimiento', () => {
  const plan = planDeuda(contexto(1));
  assert.equal(plan.noches.length, 0);
  assert.equal(plan.nochesParaObjetivo, 0);
  assert.ok(plan.acciones.some((a) => a.key === 'mantener'));
  assert.equal(plan.horarioHoy.acostarse, '23:00');
  assert.equal(plan.horarioHoy.despertar, '07:00');
});

test('planDeuda: siempre da acciones accionables, ordenadas por prioridad', () => {
  const plan = planDeuda(contexto(6));
  assert.ok(plan.acciones.length >= 5);
  for (let i = 1; i < plan.acciones.length; i++) {
    assert.ok(plan.acciones[i].prioridad >= plan.acciones[i - 1].prioridad);
  }
  for (const a of plan.acciones) {
    assert.ok(a.titulo.length > 5 && a.detalle.length > 20, `accion ${a.key} incompleta`);
  }
  const keys = plan.acciones.map((a) => a.key);
  for (const esperada of ['acostarse', 'cafeina', 'luz_manana', 'domino', 'luz_noche', 'consistencia']) {
    assert.ok(keys.includes(esperada), `falta la accion ${esperada}`);
  }
});

test('planDeuda: incluye la siesta solo cuando la ventana existe', () => {
  assert.ok(planDeuda(contexto(6)).acciones.some((a) => a.key === 'siesta'));
  assert.ok(!planDeuda(contexto(6, { siesta: null })).acciones.some((a) => a.key === 'siesta'));
});

test('planDeuda: sin hora de corte de cafeina no inventa la accion', () => {
  const plan = planDeuda(contexto(5, { horaCorteCafeina: null }));
  assert.ok(!plan.acciones.some((a) => a.key === 'cafeina'));
});

test('planDeuda: avisa cuando faltan dias de registro', () => {
  const plan = planDeuda(contexto(4, { diasSinDato: 6 }));
  const aviso = plan.acciones.find((a) => a.key === 'registrar')!;
  assert.ok(aviso.titulo.includes('6'));
});

test('planDeuda: el horario de hoy es coherente con la primera noche', () => {
  const plan = planDeuda(contexto(12));
  const n1 = plan.noches[0];
  assert.equal(n1.adelantoMin, MAX_ADELANTO_MIN);
  assert.equal(n1.estirarMin, MAX_ESTIRAR_MIN);
  assert.equal(plan.horarioHoy.acostarse, '22:15');
  assert.equal(plan.horarioHoy.despertar, '07:30');
  assert.equal(plan.horarioHoy.dormirH, 9.25);
});

test('resumenPlan: una linea con deuda, horario y horizonte', () => {
  const linea = resumenPlan(planDeuda(contexto(9)));
  assert.ok(linea.includes('Deuda de sueno'));
  assert.ok(linea.includes('22:15'));
  assert.ok(/objetivo en \d+ noches/.test(linea), linea);
  assert.ok(resumenPlan(planDeuda(contexto(1))).includes('bajo control'));
});
