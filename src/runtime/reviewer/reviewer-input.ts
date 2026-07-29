import type { GraphSnapshot } from '../graph/graph-snapshot.js';

export interface ReviewerInput {
  readonly runId: string;
  readonly workItemId: string;
  readonly capability: string;
  readonly confidence: number;
  readonly generatedEvidenceIds: readonly string[];
  readonly findings: readonly string[];
  readonly evidenceGraph: GraphSnapshot;
}