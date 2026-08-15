// Kit formulas: Capacity Remaining, Is Late, Decision Ready.

import type { StoryStage, Verdict } from './types.ts';

function asDay(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/** max(capacity - plannedPieces, 0). Non-finite or negative numbers count as 0. */
export function capacityRemaining(capacity: number, plannedPieces: number): number {
  const cap = Number.isFinite(capacity) && capacity > 0 ? capacity : 0;
  const planned = Number.isFinite(plannedPieces) && plannedPieces > 0 ? plannedPieces : 0;
  return Math.max(cap - planned, 0);
}

/**
 * True when publishDate is a calendar day strictly before `now` and the story
 * is not Live. Missing dates are not late. `now` is injectable so tests stay pure.
 */
export function isLate(
  publishDate: string | null | undefined,
  stage: StoryStage,
  now: Date | string,
): boolean {
  if (!publishDate || !publishDate.trim()) return false;
  if (stage === 'live') return false;
  return publishDate < asDay(now);
}

/** True when a verdict has been recorded (any non-blank string). */
export function decisionReady(verdict: Verdict | string | null | undefined): boolean {
  return typeof verdict === 'string' && verdict.trim().length > 0;
}
