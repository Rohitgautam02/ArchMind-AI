import type { Confidence, Provenance } from '../contracts.js';

export interface EvidenceEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly confidence: Confidence;
  readonly provenance: readonly Provenance[];
}