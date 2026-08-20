// Tests for the promotion payload validation used by
// POST /api/os/contenido/radar/promote. Pure function, no network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePromotionPayload, MAX_QUERY_LENGTH } from './promoteValidation.ts';

function validBody() {
  return {
    opportunity: {
      query: 'como usar inteligencia artificial en una empresa',
      original: 'como usar inteligencia artificial en una empresa',
      intent: 'resolver',
      cluster: 'resolver / como usar',
      opportunityScore: 0.72,
      source: 'google',
      sources: ['google', 'local'],
      observedSources: ['google'],
      generated: true,
      suggestedFormats: ['tutorial', 'video'],
      suggestedPlatforms: ['YouTube', 'LinkedIn'],
      capturedAt: '2026-08-20T12:00:00.000Z',
      volume: null,
    },
  };
}

test('promote: payload valido pasa y conserva trazabilidad', () => {
  const res = validatePromotionPayload(validBody());
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.value.query, 'como usar inteligencia artificial en una empresa');
  assert.equal(res.value.source, 'google');
  assert.deepEqual(res.value.observedSources, ['google']);
  assert.deepEqual(res.value.sources, ['google', 'local']);
  assert.equal(res.value.observed, true);
  assert.equal(res.value.generated, true);
  assert.equal(res.value.sourceType, 'mixed');
});

test('promote: rechaza body sin opportunity', () => {
  assert.equal(validatePromotionPayload({}).ok, false);
  assert.equal(validatePromotionPayload(null).ok, false);
  assert.equal(validatePromotionPayload({ opportunity: {} }).ok, false);
});

test('promote: rechaza score invalido', () => {
  for (const score of [1.5, -0.1, Number.NaN, '0.9', null]) {
    const body = validBody();
    (body.opportunity as Record<string, unknown>).opportunityScore = score;
    const res = validatePromotionPayload(body);
    assert.equal(res.ok, false, `score ${String(score)} debe rechazarse`);
    if (!res.ok) assert.match(res.error, /0 y 1/);
  }
});

test('promote: rechaza query demasiado larga', () => {
  const body = validBody();
  body.opportunity.query = 'x'.repeat(MAX_QUERY_LENGTH + 1);
  const res = validatePromotionPayload(body);
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /larga/);
});

test('promote: rechaza intent fuera del enum', () => {
  const body = validBody();
  (body.opportunity as Record<string, unknown>).intent = 'hackear';
  const res = validatePromotionPayload(body);
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /intent invalido/);
});

test('promote: sanitiza arrays (filtra no-strings, limita longitud)', () => {
  const body = validBody();
  (body.opportunity as Record<string, unknown>).suggestedFormats = [
    'video',
    42,
    'x'.repeat(100),
    null,
  ];
  (body.opportunity as Record<string, unknown>).sources = ['google', 'evil-source', 'youtube'];
  const res = validatePromotionPayload(body);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.deepEqual(res.value.suggestedFormats, ['video', 'x'.repeat(60)]);
  assert.deepEqual(res.value.sources, ['google', 'youtube']);
});

test('promote: fuente desconocida cae a observedSources o local', () => {
  const body = validBody();
  (body.opportunity as Record<string, unknown>).source = 'evil-source';
  const res = validatePromotionPayload(body);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.value.source, 'google'); // primer observedSource valido
});

test('promote: rechaza capturedAt invalida y volume negativo', () => {
  const bad1 = validBody();
  (bad1.opportunity as Record<string, unknown>).capturedAt = 'no-es-fecha';
  assert.equal(validatePromotionPayload(bad1).ok, false);

  const bad2 = validBody();
  (bad2.opportunity as Record<string, unknown>).volume = -5;
  assert.equal(validatePromotionPayload(bad2).ok, false);
});
