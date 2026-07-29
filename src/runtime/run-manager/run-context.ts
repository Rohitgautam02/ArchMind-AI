import type { EvidenceGraph } from '../graph/evidence-graph.js';

export interface RunContext {
  readonly runId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly evidenceGraph: EvidenceGraph;
}