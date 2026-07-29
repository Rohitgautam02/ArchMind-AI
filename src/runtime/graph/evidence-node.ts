import type { Confidence, Provenance } from '../contracts.js';

export interface EvidenceNode {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly value?: unknown;
  readonly confidence: Confidence;
  readonly provenance: readonly Provenance[];
}