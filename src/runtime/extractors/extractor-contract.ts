import type { EvidenceNode } from '../contracts.js';

export interface ExtractorContext {
  readonly targetPath: string;
  readonly runId: string;
}

export interface Extractor {
  readonly id: string;
  canHandle(context: ExtractorContext): Promise<boolean>;
  extract(context: ExtractorContext): Promise<EvidenceNode[]>;
}
