import type { EvidenceNode, EvidenceEdge } from '../contracts.js';

export interface ExtractorContext {
  readonly targetPath: string;
  readonly runId: string;
}

export interface ExtractorResult {
  readonly nodes: EvidenceNode[];
  readonly edges: EvidenceEdge[];
}

export interface Extractor {
  readonly id: string;
  canHandle(context: ExtractorContext): Promise<boolean>;
  extract(context: ExtractorContext): Promise<ExtractorResult>;
}
