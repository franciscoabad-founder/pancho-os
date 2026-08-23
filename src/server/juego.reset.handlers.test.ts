// Contrato del reset del Juego sin tocar Supabase real: se inyecta un doble en
// memoria. Cubre el patch puro y el orden/alcance de las escrituras.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ejecutarResetJuego, patchJugadorReset } from './juego.reset.handlers.ts';
import {
  mecanicasDelOnboarding,
  questDelOnboarding,
  recompensasDelOnboarding,
} from '../os/components/onboarding/flujoJuego.ts';

type Fila = Record<string, unknown>;

function crearClienteFake(estado: { jugador: Fila[]; xp_events: Fila[]; quests: Fila[] }): SupabaseClient {
  function tabla(nombre: string): Fila[] {
    const mapa: Record<string, Fila[]> = estado as unknown as Record<string, Fila[]>;
    if (!mapa[nombre]) throw new Error(`tabla fake no soportada: ${nombre}`);
    return mapa[nombre];
  }

  function builder(nombre: string) {
    let modo: 'select' | 'update' | 'delete' = 'select';
    let patch: Fila = {};
    let unico = false;
    const filtros: Array<(f: Fila) => boolean> = [];

    const api: any = {
      select: () => api,
      limit: () => api,
      eq: (col: string, val: unknown) => { filtros.push((f) => f[col] === val); return api; },
      not: () => api,
      update: (p: Fila) => { modo = 'update'; patch = p; return api; },
      delete: () => { modo = 'delete'; return api; },
      single: () => { unico = true; return api; },
      then: (resolve: (r: any) => unknown) => resolve(ejecutar()),
    };

    function ejecutar() {
      const filas = tabla(nombre);
      const afectadas = filas.filter((f) => filtros.every((fn) => fn(f)));
      if (modo === 'update') {
        for (const f of afectadas) Object.assign(f, patch);
        return { data: unico ? (afectadas[0] ?? null) : afectadas, error: null };
      }
      if (modo === 'delete') {
        const borradas = [...afectadas];
        for (const f of borradas) filas.splice(filas.indexOf(f), 1);
        return { data: borradas, error: null };
      }
      return { data: unico ? (afectadas[0] ?? null) : afectadas, error: null };
    }

    return api;
  }

  return { from: (nombre: string) => builder(nombre) } as unknown as SupabaseClient;
}

test('patchJugadorReset deja nivel 1, sin oro y con la vida llena', () => {
  const patch = patchJugadorReset({ hp_max: 50 }, '2026-08-24T00:00:00.000Z');
  assert.deepEqual(patch, { xp_total: 0, oro: 0, hp: 50, updated_at: '2026-08-24T00:00:00.000Z' });
});

test('patchJugadorReset cae a 50 de vida si hp_max viene corrupto', () => {
  assert.equal(patchJugadorReset({ hp_max: null }).hp, 50);
  assert.equal(patchJugadorReset({ hp_max: 0 }).hp, 50);
});

test('ejecutarResetJuego borra eventos, cancela quests activas y cerea al jugador', async () => {
  const estado = {
    jugador: [{ id: 'j1', xp_total: 95, oro: 77, hp: 20, hp_max: 50 }],
    xp_events: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
    quests: [
      { id: 'q1', estado: 'activa' },
      { id: 'q2', estado: 'ganada' },
    ],
  };
  const sb = crearClienteFake(estado);
  const res = await ejecutarResetJuego(sb);

  assert.equal(res.eventosBorrados, 3);
  assert.equal(estado.xp_events.length, 0);
  assert.equal(res.questsCanceladas, 1);
  assert.equal(estado.quests[0].estado, 'cancelada');
  assert.equal(estado.quests[1].estado, 'ganada', 'el historial de quests no se toca');
  assert.equal(estado.jugador[0].xp_total, 0);
  assert.equal(estado.jugador[0].oro, 0);
  assert.equal(estado.jugador[0].hp, 50);
});

test('ejecutarResetJuego falla claro si no hay jugador', async () => {
  const sb = crearClienteFake({ jugador: [], xp_events: [], quests: [] });
  await assert.rejects(() => ejecutarResetJuego(sb), /jugador no encontrado/);
});

test('mecanicasDelOnboarding respeta lo elegido y por defecto enciende todo', () => {
  assert.deepEqual(mecanicasDelOnboarding({}), { hp_activo: true, oro_activo: true, loot_activo: true });
  assert.deepEqual(mecanicasDelOnboarding({ mecanicas_on: ['oro'] }), {
    hp_activo: false, oro_activo: true, loot_activo: false,
  });
});

test('recompensasDelOnboarding ignora vacios y aplica costo por defecto', () => {
  const lista = recompensasDelOnboarding({
    recompensas: { r1: ' Serie ', r2: '   ', r3: 'Almuerzo' },
    costos: { c1: 120, c3: 0 },
  });
  assert.deepEqual(lista, [
    { nombre: 'Serie', costo_oro: 120 },
    { nombre: 'Almuerzo', costo_oro: 50 },
  ]);
});

test('questDelOnboarding devuelve null sin titulo y normaliza numeros', () => {
  assert.equal(questDelOnboarding({ quest: { titulo: '  ' } }), null);
  assert.deepEqual(
    questDelOnboarding({ quest: { titulo: '4 gyms' }, quest_evento: 'sesion_gym', quest_numeros: { meta: 0, apuesta: 20 } }),
    { titulo: '4 gyms', evento: 'sesion_gym', meta: 1, apuesta_oro: 20, premio_xp: 30 },
  );
});
