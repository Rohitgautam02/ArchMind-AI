import type { DerivedFact, Hypothesis, Provenance } from '../contracts.js';
import type { EvidenceConflict, GraphUpdate } from './graph-update.js';
import type { EvidenceEdge } from './evidence-edge.js';
import type { EvidenceNode } from './evidence-node.js';

export interface GraphSnapshot {
  readonly runId: string;
  readonly nodes: readonly EvidenceNode[];
  readonly edges: readonly EvidenceEdge[];
  readonly derivedFacts: readonly DerivedFact[];
  readonly conflicts: readonly EvidenceConflict[];
  readonly hypotheses: readonly Hypothesis[];
  readonly provenance: readonly Provenance[];
  readonly createdAt: string;
}

export interface GraphSnapshotInput {
  readonly runId: string;
  readonly nodes: readonly EvidenceNode[];
  readonly edges: readonly EvidenceEdge[];
  readonly derivedFacts: readonly DerivedFact[];
  readonly conflicts: readonly EvidenceConflict[];
  readonly hypotheses: readonly Hypothesis[];
  readonly provenance: readonly Provenance[];
  readonly createdAt: string;
}

export type GraphPatch = GraphUpdate;