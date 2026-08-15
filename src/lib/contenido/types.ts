// Content Planner domain types. Pure data shapes for Listen -> Shape -> Ship -> Learn.

export const SIGNAL_STATUSES = ['new', 'ready', 'in_use', 'archived'] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export const CAMPAIGN_STATUSES = ['planned', 'active', 'completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const SPRINT_STATUSES = ['planned', 'active', 'completed'] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export const STORY_STAGES = ['brief', 'shaping', 'ready', 'scheduled', 'live'] as const;
export type StoryStage = (typeof STORY_STAGES)[number];

export const VERDICTS = ['reuse', 'refine', 'retire'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const RIGHTS_STATUSES = [
  'unknown',
  'internal_reference_only',
  'cleared',
  'restricted',
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const STRENGTH_MIN = 1;
export const STRENGTH_MAX = 5;
export const STRONG_SIGNAL_MIN = 4;

export function isValidStrength(n: number): boolean {
  return Number.isInteger(n) && n >= STRENGTH_MIN && n <= STRENGTH_MAX;
}

export interface Signal {
  id: string;
  name: string;
  exactWords: string;
  source: string | null;
  audienceMoment: string | null;
  tension: string | null;
  strength: number;
  theme: string | null;
  status: SignalStatus;
  capturedOn: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string | null;
  offer: string | null;
  audience: string | null;
  promise: string | null;
  cta: string | null;
  startDate: string | null;
  endDate: string | null;
  primaryKpi: string | null;
  target: number | null;
  status: CampaignStatus;
}

export interface WeeklySprint {
  id: string;
  name: string;
  weekOf: string;
  capacity: number;
  focus: string | null;
  campaignId: string | null;
  plannedPieces: number;
  shippedPieces: number;
  status: SprintStatus;
}

export interface Story {
  id: string;
  name: string;
  signalId: string | null;
  campaignId: string | null;
  sprintId: string | null;
  parentStoryId: string | null;
  channel: string | null;
  format: string | null;
  stage: StoryStage;
  publishDate: string | null;
  promise: string | null;
  hook: string | null;
  cta: string | null;
  nextAction: string | null;
  derivativeStatus: string | null;
  accessibilityCheck: string | null;
}

export interface ProofAsset {
  id: string;
  name: string;
  type: string | null;
  source: string | null;
  rightsStatus: RightsStatus | null;
  claim: string | null;
  fileOrUrl: string | null;
  capturedOn: string | null;
  expiry: string | null;
  storyId: string | null;
  notes: string | null;
}

export interface Result {
  id: string;
  name: string;
  storyId: string;
  publishedOn: string | null;
  primaryKpi: string | null;
  kpiResult: number | null;
  reachOrViews: number | null;
  saves: number | null;
  repliesOrComments: number | null;
  clicks: number | null;
  leads: number | null;
  sales: number | null;
  audienceLanguage: string | null;
  verdict: Verdict | null;
  nextTest: string | null;
  repurposeQueue: string | null;
}
