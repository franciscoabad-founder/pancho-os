import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORY_STAGES } from './types.ts';
import { canTransition, nextStages, transitionStage } from './stages.ts';
import type { StoryStage } from './types.ts';

const FORWARD: Array<[StoryStage, StoryStage]> = [
  ['brief', 'shaping'],
  ['shaping', 'ready'],
  ['ready', 'scheduled'],
  ['ready', 'live'],
  ['scheduled', 'live'],
];

const BACKWARD: Array<[StoryStage, StoryStage]> = [
  ['shaping', 'brief'],
  ['ready', 'shaping'],
  ['scheduled', 'ready'],
];

test('STORY_STAGES follows Brief -> Shaping -> Ready -> Scheduled -> Live', () => {
  assert.deepEqual([...STORY_STAGES], ['brief', 'shaping', 'ready', 'scheduled', 'live']);
});

test('canTransition: allowed forward moves', () => {
  for (const [from, to] of FORWARD) {
    assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
  }
});

test('canTransition: allowed backward rework', () => {
  for (const [from, to] of BACKWARD) {
    assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
  }
});

test('canTransition: live is terminal', () => {
  for (const to of STORY_STAGES) {
    assert.equal(canTransition('live', to), false, `live -> ${to}`);
  }
});

test('canTransition: cannot skip stages (brief to ready, brief to live, shaping to live)', () => {
  assert.equal(canTransition('brief', 'ready'), false);
  assert.equal(canTransition('brief', 'scheduled'), false);
  assert.equal(canTransition('brief', 'live'), false);
  assert.equal(canTransition('shaping', 'scheduled'), false);
  assert.equal(canTransition('shaping', 'live'), false);
});

test('canTransition: same stage is not a transition', () => {
  for (const stage of STORY_STAGES) {
    assert.equal(canTransition(stage, stage), false, stage);
  }
});

test('nextStages: lists only legal destinations', () => {
  assert.deepEqual(nextStages('brief'), ['shaping']);
  assert.deepEqual(nextStages('shaping'), ['brief', 'ready']);
  assert.deepEqual(nextStages('ready'), ['shaping', 'scheduled', 'live']);
  assert.deepEqual(nextStages('scheduled'), ['ready', 'live']);
  assert.deepEqual(nextStages('live'), []);
});

test('transitionStage: returns the new stage when legal', () => {
  const result = transitionStage('brief', 'shaping');
  assert.deepEqual(result, { ok: true, from: 'brief', to: 'shaping' });
});

test('transitionStage: rejects an illegal jump', () => {
  const result = transitionStage('brief', 'live');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.from, 'brief');
    assert.equal(result.to, 'live');
    assert.match(result.reason, /invalid stage transition/i);
  }
});
