import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERDICTS } from './types.ts';
import { inReuseQueue, isVerdict, parseVerdict } from './verdicts.ts';

test('VERDICTS is the closed Reuse / Refine / Retire set', () => {
  assert.deepEqual([...VERDICTS], ['reuse', 'refine', 'retire']);
});

test('isVerdict: only the three closed values', () => {
  assert.equal(isVerdict('reuse'), true);
  assert.equal(isVerdict('refine'), true);
  assert.equal(isVerdict('retire'), true);
  assert.equal(isVerdict('Reuse'), false);
  assert.equal(isVerdict('maybe'), false);
  assert.equal(isVerdict(null), false);
  assert.equal(isVerdict(''), false);
});

test('parseVerdict: trims and lowercases known values', () => {
  assert.equal(parseVerdict('Reuse'), 'reuse');
  assert.equal(parseVerdict(' REFINE '), 'refine');
  assert.equal(parseVerdict('retire'), 'retire');
  assert.equal(parseVerdict('keep'), null);
  assert.equal(parseVerdict(null), null);
  assert.equal(parseVerdict(''), null);
});

test('inReuseQueue: verdict reuse or a non-empty repurpose queue', () => {
  assert.equal(inReuseQueue({ verdict: 'reuse', repurposeQueue: null }), true);
  assert.equal(inReuseQueue({ verdict: 'refine', repurposeQueue: 'Carousel + checklist' }), true);
  assert.equal(inReuseQueue({ verdict: 'retire', repurposeQueue: '  ' }), false);
  assert.equal(inReuseQueue({ verdict: null, repurposeQueue: null }), false);
  assert.equal(inReuseQueue({ verdict: 'refine', repurposeQueue: null }), false);
});
