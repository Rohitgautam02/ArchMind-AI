export interface ArchitectureAgentResult {
  readonly runId: string;
  readonly workItemId: string;
  readonly capability: 'ArchitectureAgent';
  readonly evidenceIds: readonly string[];
  readonly generatedEvidenceLabels: readonly string[];
  readonly evidenceCount: number;
  readonly confidence: number;
  readonly summary: string;
}