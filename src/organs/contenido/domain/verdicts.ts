// Learn-loop verdicts: Reuse, Refine, Retire.

import { VERDICTS, type Verdict } from './types.ts';

export function isVerdict(value: string | null | undefined): value is Verdict {
  return (VERDICTS as readonly string[]).includes(value ?? '');
}

export function parseVerdict(value: string | null | undefined): Verdict | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  return isVerdict(normalized) ? normalized : null;
}

/** Desk reuse queue: Verdict = Reuse or a non-empty repurpose queue. */
export function inReuseQueue(result: {
  verdict: Verdict | string | null;
  repurposeQueue: string | null;
}): boolean {
  if (parseVerdict(result.verdict) === 'reuse') return true;
  return Boolean(result.repurposeQueue?.trim());
}
