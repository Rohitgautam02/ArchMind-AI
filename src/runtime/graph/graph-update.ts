import type { Confidence, DerivedFact, Hypothesis, Provenance } from '../contracts.js';
import type { EvidenceEdge } from './evidence-edge.js';
import type { EvidenceNode } from './evidence-node.js';

export interface EvidenceConflict {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectType: 'node' | 'edge';
  readonly summary: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly existingIds: readonly string[];
  readonly incomingIds: readonly string[];
  readonly provenance: readonly Provenance[];
}

export interface GraphUpdate {
  readonly nodes?: readonly EvidenceNode[];
  readonly edges?: readonly EvidenceEdge[];
  readonly derivedFacts?: readonly DerivedFact[];
  readonly conflicts?: readonly EvidenceConflict[];
  readonly hypotheses?: readonly Hypothesis[];
  readonly provenance: Provenance;
}

export interface ConfidenceMergeResult {
  readonly confidence: Confidence;
  readonly keptId: string;
}