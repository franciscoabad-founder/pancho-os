import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capacityRemaining, isLate, decisionReady } from './formulas.ts';

test('capacityRemaining: capacity minus planned pieces', () => {
  assert.equal(capacityRemaining(3, 2), 1);
  assert.equal(capacityRemaining(3, 3), 0);
  assert.equal(capacityRemaining(3, 0), 3);
});

test('capacityRemaining: never goes below zero', () => {
  assert.equal(capacityRemaining(3, 5), 0);
  assert.equal(capacityRemaining(0, 1), 0);
});

test('capacityRemaining: non-finite or negative inputs treat as zero leftover', () => {
  assert.equal(capacityRemaining(Number.NaN, 1), 0);
  assert.equal(capacityRemaining(3, Number.NaN), 3);
  assert.equal(capacityRemaining(-2, 1), 0);
  assert.equal(capacityRemaining(3, -1), 3);
});

test('isLate: publish date before now and stage is not live', () => {
  assert.equal(isLate('2026-08-01', 'ready', '2026-08-15'), true);
  assert.equal(isLate('2026-08-01', 'scheduled', '2026-08-15'), true);
  assert.equal(isLate('2026-08-01', 'shaping', '2026-08-15'), true);
  assert.equal(isLate('2026-08-01', 'brief', '2026-08-15'), true);
});

test('isLate: live stories are never late', () => {
  assert.equal(isLate('2026-08-01', 'live', '2026-08-15'), false);
});

test('isLate: publish date today or in the future is not late', () => {
  assert.equal(isLate('2026-08-15', 'ready', '2026-08-15'), false);
  assert.equal(isLate('2026-08-20', 'scheduled', '2026-08-15'), false);
});

test('isLate: missing publish date is not late', () => {
  assert.equal(isLate(null, 'ready', '2026-08-15'), false);
  assert.equal(isLate('', 'ready', '2026-08-15'), false);
});

test('isLate: accepts a Date as now', () => {
  assert.equal(isLate('2026-08-01', 'ready', new Date('2026-08-15T18:00:00Z')), true);
});

test('decisionReady: true only when verdict is present', () => {
  assert.equal(decisionReady('reuse'), true);
  assert.equal(decisionReady('refine'), true);
  assert.equal(decisionReady('retire'), true);
  assert.equal(decisionReady(null), false);
  assert.equal(decisionReady(undefined), false);
  assert.equal(decisionReady(''), false);
  assert.equal(decisionReady('   '), false);
});
