// Weekly constraint: one parent story and at most three pieces.

import type { Story } from './types.ts';

export const WEEKLY_MAX_PARENTS = 1;
export const WEEKLY_MAX_PIECES = 3;

export type WeeklyViolationCode = 'too_many_parents' | 'too_many_pieces' | 'missing_parent';

export interface WeeklyViolation {
  code: WeeklyViolationCode;
  message: string;
}

export interface WeeklyValidation {
  ok: boolean;
  parents: number;
  pieces: number;
  violations: WeeklyViolation[];
}

export function isParentStory(story: Story): boolean {
  return story.parentStoryId == null;
}

export function validateWeeklyRule(stories: readonly Story[]): WeeklyValidation {
  const list = stories ?? [];
  const pieces = list.length;
  const parentIds = new Set(list.filter(isParentStory).map((s) => s.id));
  const parents = parentIds.size;
  const violations: WeeklyViolation[] = [];

  if (parents > WEEKLY_MAX_PARENTS) {
    violations.push({
      code: 'too_many_parents',
      message: `A week may have at most ${WEEKLY_MAX_PARENTS} parent story (found ${parents}).`,
    });
  }

  if (pieces > WEEKLY_MAX_PIECES) {
    violations.push({
      code: 'too_many_pieces',
      message: `A week may have at most ${WEEKLY_MAX_PIECES} pieces (found ${pieces}).`,
    });
  }

  const orphans = list.filter((s) => s.parentStoryId != null && !parentIds.has(s.parentStoryId));
  if (orphans.length > 0 || (pieces > 0 && parents === 0)) {
    violations.push({
      code: 'missing_parent',
      message: 'Every committed week needs its parent story in the same sprint.',
    });
  }

  return { ok: violations.length === 0, parents, pieces, violations };
}
