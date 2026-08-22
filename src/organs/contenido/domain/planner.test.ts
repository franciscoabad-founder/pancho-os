// Tests for the planner API validation layer and desk helpers. Pure, no IO.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeEntity,
  validateStageChange,
  validateSprintAssignment,
  weekMonday,
  todayIn,
  isUuid,
  PLANNER_ENTITIES,
} from './planner.ts';
import type { Story } from './types.ts';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

// --- sanitizeEntity ---

test('sanitize: signal valida pasa con campos recortados', () => {
  const res = sanitizeEntity('signals', {
    name: '  Pregunta sobre IA  ',
    exact_words: 'como le haces para que no te reemplace la IA',
    strength: 5,
    status: 'new',
    captured_on: '2026-08-20',
  }, false);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.row.name, 'Pregunta sobre IA');
  assert.equal(res.row.strength, 5);
});

test('sanitize: rechaza signal sin exact_words y sin name', () => {
  const res = sanitizeEntity('signals', { name: 'x' }, false);
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /exact_words/);
});

test('sanitize: rechaza strength fuera de 1..5', () => {
  for (const strength of [0, 6, 4.5, 'mucho']) {
    const res = sanitizeEntity('signals', { name: 'x', exact_words: 'y', strength }, false);
    assert.equal(res.ok, false, `strength ${strength} debe rechazarse`);
  }
});

test('sanitize: descarta campos no permitidos (whitelist)', () => {
  const res = sanitizeEntity('stories', {
    name: 'Historia',
    stage: 'brief',
    sprint_id: UUID_A,
    hacker_field: 'drop table',
    id: UUID_B,
  }, false);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.row.hacker_field, undefined);
  assert.equal(res.row.id, undefined);
  assert.equal(res.row.sprint_id, UUID_A);
});

test('sanitize: rechaza uuid invalido en llaves foraneas', () => {
  const res = sanitizeEntity('stories', { name: 'x', sprint_id: 'no-es-uuid' }, false);
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /sprint_id/);
});

test('sanitize: rechaza enum invalido en status/stage/verdict', () => {
  assert.equal(sanitizeEntity('signals', { name: 'x', exact_words: 'y', status: 'volando' }, false).ok, false);
  assert.equal(sanitizeEntity('stories', { name: 'x', stage: 'publicadisima' }, false).ok, false);
  assert.equal(sanitizeEntity('results', { name: 'x', story_id: UUID_A, verdict: 'genial' }, false).ok, false);
});

test('sanitize: sprints no acepta planned_pieces del cliente', () => {
  const res = sanitizeEntity('sprints', {
    name: 'Semana',
    week_of: '2026-08-17',
    planned_pieces: 99,
    capacity: 3,
  }, false);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.row.planned_pieces, undefined);
  assert.equal(res.row.capacity, 3);
});

test('sanitize: PATCH parcial sin campos se rechaza', () => {
  const res = sanitizeEntity('stories', { otro: 'campo' }, true);
  assert.equal(res.ok, false);
});

test('sanitize: results exige story_id valido', () => {
  assert.equal(sanitizeEntity('results', { name: 'x' }, false).ok, false);
  const ok = sanitizeEntity('results', { name: 'x', story_id: UUID_A, verdict: 'reuse' }, false);
  assert.ok(ok.ok);
});

// --- validateStageChange ---

test('stage: avance valido y retroceso de un paso', () => {
  assert.ok(validateStageChange('brief', { stage: 'shaping' }).ok);
  assert.ok(validateStageChange('shaping', { stage: 'brief' }).ok);
  assert.ok(validateStageChange('ready', { stage: 'live' }).ok);
});

test('stage: rechaza saltos y movimientos desde live', () => {
  const salto = validateStageChange('brief', { stage: 'live' });
  assert.equal(salto.ok, false);
  if (!salto.ok) assert.match(salto.error, /brief -> live/);
  assert.equal(validateStageChange('live', { stage: 'brief' }).ok, false);
});

test('stage: sin cambio de etapa siempre pasa', () => {
  assert.ok(validateStageChange('brief', { name: 'otro' }).ok);
  assert.ok(validateStageChange('brief', { stage: 'brief' }).ok);
});

// --- validateSprintAssignment (regla semanal en servidor) ---

function story(id: string, parentStoryId: string | null): Story {
  return { id, parentStoryId } as Story;
}

test('sprint: una padre y hasta 3 piezas pasa', () => {
  const existing = [story(UUID_A, null), story(UUID_B, UUID_A)];
  const res = validateSprintAssignment(existing, story(UUID_C, UUID_A));
  assert.ok(res.ok);
  assert.equal(res.pieces, 3);
});

test('sprint: la cuarta pieza se rechaza', () => {
  const existing = [story(UUID_A, null), story(UUID_B, UUID_A), story(UUID_C, UUID_A)];
  const res = validateSprintAssignment(existing, story('dddddddd-dddd-4ddd-8ddd-dddddddddddd', UUID_A));
  assert.equal(res.ok, false);
  assert.ok(res.violations.some((v) => v.code === 'too_many_pieces'));
});

test('sprint: una segunda padre se rechaza', () => {
  const existing = [story(UUID_A, null)];
  const res = validateSprintAssignment(existing, story(UUID_B, null));
  assert.equal(res.ok, false);
  assert.ok(res.violations.some((v) => v.code === 'too_many_parents'));
});

test('sprint: corte sin padre en el sprint se rechaza', () => {
  const res = validateSprintAssignment([], story(UUID_B, UUID_A));
  assert.equal(res.ok, false);
  assert.ok(res.violations.some((v) => v.code === 'missing_parent'));
});

// --- weekMonday ---

test('weekMonday: lunes de la semana actual', () => {
  assert.equal(weekMonday('2026-08-20'), '2026-08-17'); // jueves
  assert.equal(weekMonday('2026-08-17'), '2026-08-17'); // lunes
  assert.equal(weekMonday('2026-08-23'), '2026-08-17'); // domingo
  assert.equal(weekMonday('2026-01-01'), '2025-12-29'); // cruza de ano
});

// --- misc ---

test('isUuid valida formato', () => {
  assert.ok(isUuid(UUID_A));
  assert.ok(!isUuid('1234'));
  assert.ok(!isUuid(null));
});

test('PLANNER_ENTITIES cubre las 6 tablas', () => {
  assert.deepEqual([...PLANNER_ENTITIES], ['signals', 'campaigns', 'sprints', 'stories', 'assets', 'results']);
});

test('sanitize: campana valida pasa; target no numerico se rechaza', () => {
  const ok = sanitizeEntity('campaigns', { name: 'Kit IA', status: 'active', target: 100 }, false);
  assert.ok(ok.ok);
  const bad = sanitizeEntity('campaigns', { name: 'Kit IA', target: 'cien' }, false);
  assert.equal(bad.ok, false);
});

test('sanitize: asset con rights_status valido; invalido se rechaza', () => {
  const ok = sanitizeEntity('assets', { name: 'Captura testimonio', rights_status: 'cleared', story_id: UUID_A }, false);
  assert.ok(ok.ok);
  const bad = sanitizeEntity('assets', { name: 'x', rights_status: 'pirateado' }, false);
  assert.equal(bad.ok, false);
});

test('sanitize: fecha con formato invalido se rechaza', () => {
  const bad = sanitizeEntity('sprints', { name: 'S', week_of: '17-08-2026' }, false);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /week_of/);
});

test('weekMonday: usa fecha civil de Ecuador, no UTC', () => {
  // 2026-08-24 02:00 UTC ya es lunes en UTC, pero en Ecuador (UTC-5) es
  // domingo 21:00 del 23: la semana sigue siendo la del lunes 17.
  assert.equal(weekMonday('2026-08-24T02:00:00Z'), '2026-08-17');
  // Lunes 20:00 UTC = lunes 15:00 en Ecuador: semana del 24.
  assert.equal(weekMonday('2026-08-24T20:00:00Z'), '2026-08-24');
});

test('stage: null explicito se rechaza en PATCH', () => {
  const res = validateStageChange('brief', { stage: null });
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /null/);
});

test('todayIn devuelve fecha civil YYYY-MM-DD', () => {
  assert.match(todayIn(), /^\d{4}-\d{2}-\d{2}$/);
});
