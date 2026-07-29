import type { ReviewDecision } from './review-decision.js';

export interface ReviewerResult {
  readonly runId: string;
  readonly workItemId: string;
  readonly decision: ReviewDecision;
  readonly confidence: number;
  readonly reasons: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly reviewedAt: string;
}