// Story stage machine. Forward: Brief -> Shaping -> Ready -> Scheduled|Live.
// Rework may step one stage back. Live is terminal.

import { STORY_STAGES, type StoryStage } from './types.ts';

const TRANSITIONS: Record<StoryStage, readonly StoryStage[]> = {
  brief: ['shaping'],
  shaping: ['brief', 'ready'],
  ready: ['shaping', 'scheduled', 'live'],
  scheduled: ['ready', 'live'],
  live: [],
};

export type StageTransition =
  | { ok: true; from: StoryStage; to: StoryStage }
  | { ok: false; from: StoryStage; to: StoryStage; reason: string };

export function nextStages(from: StoryStage): readonly StoryStage[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: StoryStage, to: StoryStage): boolean {
  return nextStages(from).includes(to);
}

export function transitionStage(from: StoryStage, to: StoryStage): StageTransition {
  if (canTransition(from, to)) return { ok: true, from, to };
  return {
    ok: false,
    from,
    to,
    reason: `Invalid stage transition: ${from} -> ${to}`,
  };
}

export function isStoryStage(value: string): value is StoryStage {
  return (STORY_STAGES as readonly string[]).includes(value);
}
