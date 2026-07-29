import type { MetadataExtractionSummary } from './metadata-types.js';

export interface MetadataResult {
  readonly extractedAt: string;
  readonly summary: MetadataExtractionSummary;
}