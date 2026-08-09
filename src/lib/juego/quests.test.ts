import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarQuest, liquidarQuest } from './quests.ts';

test('evaluarQuest conteo_eventos: cumplida cuando progreso >= meta', () => {
  const eventos = [
    { tipo: 'sesion_gym', fecha: '2026-07-13' },
    { tipo: 'sesion_gym', fecha: '2026-07-14' },
    { tipo: 'comida_log', fecha: '2026-07-14' },
  ];
  const r = evaluarQuest({ tipo: 'conteo_eventos', evento: 'sesion_gym', meta: 2 }, eventos, []);
  assert.equal(r.estado, 'cumplida');
  assert.equal(r.progreso, 2);
  assert.equal(r.meta, 2);
});

test('evaluarQuest acepta el alias "evento" (usado por el front y datos legacy)', () => {
  const eventos = [
    { tipo: 'sesion_gym', fecha: '2026-07-13' },
    { tipo: 'sesion_gym', fecha: '2026-07-14' },
  ];
  const r = evaluarQuest({ tipo: 'evento', evento: 'sesion_gym', meta: 2 }, eventos, []);
  assert.equal(r.estado, 'cumplida');
  assert.equal(r.progreso, 2);
});

test('evaluarQuest conteo_eventos: pendiente si no alcanza la meta', () => {
  const eventos = [{ tipo: 'sesion_gym', fecha: '2026-07-13' }];
  const r = evaluarQuest({ tipo: 'conteo_eventos', evento: 'sesion_gym', meta: 4 }, eventos, []);
  assert.equal(r.estado, 'pendiente');
  assert.equal(r.progreso, 1);
});

test('evaluarQuest habito: cuenta checks del habito especifico', () => {
  const checks = [
    { habito_id: 'h1', fecha: '2026-07-10' },
    { habito_id: 'h1', fecha: '2026-07-11' },
    { habito_id: 'h2', fecha: '2026-07-11' },
  ];
  const r = evaluarQuest({ tipo: 'habito', habito_id: 'h1', meta: 2 }, [], checks);
  assert.equal(r.estado, 'cumplida');
  assert.equal(r.progreso, 2);
});

test('evaluarQuest habito: no confunde habitos distintos', () => {
  const checks = [{ habito_id: 'h2', fecha: '2026-07-11' }];
  const r = evaluarQuest({ tipo: 'habito', habito_id: 'h1', meta: 1 }, [], checks);
  assert.equal(r.estado, 'pendiente');
  assert.equal(r.progreso, 0);
});

test('liquidarQuest ganada: paga premio_xp + premio_oro + devuelve la apuesta', () => {
  const quest = { apuesta_oro: 20, premio_xp: 50, premio_oro: 30 };
  const r = liquidarQuest(quest, true);
  assert.deepEqual(r, { xpDelta: 50, oroDelta: 50 });
});

test('liquidarQuest perdida: no devuelve nada (la apuesta ya se descontó al crearla)', () => {
  const quest = { apuesta_oro: 20, premio_xp: 50, premio_oro: 30 };
  const r = liquidarQuest(quest, false);
  assert.deepEqual(r, { xpDelta: 0, oroDelta: 0 });
});
