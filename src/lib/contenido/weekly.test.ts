import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWeeklyRule, WEEKLY_MAX_PARENTS, WEEKLY_MAX_PIECES } from './weekly.ts';
import type { Story } from './types.ts';

function story(overrides: Partial<Story> = {}): Story {
  return {
    id: 's1',
    name: 'Parent',
    signalId: null,
    campaignId: null,
    sprintId: 'sprint-1',
    parentStoryId: null,
    channel: null,
    format: null,
    stage: 'brief',
    publishDate: null,
    promise: null,
    hook: null,
    cta: null,
    nextAction: null,
    derivativeStatus: 'parent',
    accessibilityCheck: null,
    ...overrides,
  };
}

test('weekly constants: one parent, three pieces', () => {
  assert.equal(WEEKLY_MAX_PARENTS, 1);
  assert.equal(WEEKLY_MAX_PIECES, 3);
});

test('validateWeeklyRule: empty week is allowed (nothing committed yet)', () => {
  const result = validateWeeklyRule([]);
  assert.equal(result.ok, true);
  assert.equal(result.parents, 0);
  assert.equal(result.pieces, 0);
  assert.deepEqual(result.violations, []);
});

test('validateWeeklyRule: one parent and two derivatives is the intended week', () => {
  const parent = story({ id: 'p1', name: 'Parent', parentStoryId: null });
  const d1 = story({ id: 'd1', name: 'Cut 1', parentStoryId: 'p1', derivativeStatus: 'derivative' });
  const d2 = story({ id: 'd2', name: 'Cut 2', parentStoryId: 'p1', derivativeStatus: 'derivative' });
  const result = validateWeeklyRule([parent, d1, d2]);
  assert.equal(result.ok, true);
  assert.equal(result.parents, 1);
  assert.equal(result.pieces, 3);
  assert.deepEqual(result.violations, []);
});

test('validateWeeklyRule: a lone parent is allowed', () => {
  const result = validateWeeklyRule([story({ id: 'p1' })]);
  assert.equal(result.ok, true);
  assert.equal(result.parents, 1);
  assert.equal(result.pieces, 1);
});

test('validateWeeklyRule: two parents is a violation', () => {
  const result = validateWeeklyRule([
    story({ id: 'p1', name: 'A' }),
    story({ id: 'p2', name: 'B' }),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.parents, 2);
  assert.ok(result.violations.some((v) => v.code === 'too_many_parents'));
});

test('validateWeeklyRule: four pieces is a violation', () => {
  const parent = story({ id: 'p1' });
  const result = validateWeeklyRule([
    parent,
    story({ id: 'd1', parentStoryId: 'p1', derivativeStatus: 'derivative' }),
    story({ id: 'd2', parentStoryId: 'p1', derivativeStatus: 'derivative' }),
    story({ id: 'd3', parentStoryId: 'p1', derivativeStatus: 'derivative' }),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.pieces, 4);
  assert.ok(result.violations.some((v) => v.code === 'too_many_pieces'));
});

test('validateWeeklyRule: derivatives without a parent in the week are a violation', () => {
  const result = validateWeeklyRule([
    story({ id: 'd1', parentStoryId: 'missing', derivativeStatus: 'derivative' }),
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.code === 'missing_parent'));
});

test('validateWeeklyRule: parent is detected by missing parentStoryId, not by label', () => {
  const unlabeled = story({ id: 'p1', derivativeStatus: null });
  const result = validateWeeklyRule([unlabeled]);
  assert.equal(result.ok, true);
  assert.equal(result.parents, 1);
});
