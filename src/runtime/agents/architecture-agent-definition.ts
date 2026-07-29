import { z } from 'zod';
import type { EvidenceNode, Provenance } from '../contracts.js';
import type { AgentDefinition } from './agent-runtime.js';

export const architectureOutputSchema = z.object({
  architecture: z.string().describe('The primary architectural pattern detected (e.g. monolith, microservices, modular-monolith)'),
  boundaries: z.array(z.string()).describe('The names of the distinct domain modules or context boundaries detected'),
  rationale: z.string().describe('The reasoning for why this architecture was selected'),
}).describe('Detected architecture and boundaries');

export type ArchitectureLLMOutput = z.infer<typeof architectureOutputSchema>;

export const architectureAgentDefinition: AgentDefinition<ArchitectureLLMOutput> = {
  outputSchema: architectureOutputSchema,
  requiredEvidence: ['metadata:repository'],
  producedEvidence: ['ArchitectureDetected', 'ModuleBoundaryDetected'],
  isDeterministicEvidenceSufficient: () => false,
  buildSystemPrompt: () => 'You are an architecture agent. Analyze the repository metadata and return structured JSON with the architecture style and module boundaries.',
  buildUserPrompt: () => 'Analyze the repository context.',
  mapToEvidence: (result, context) => {
    const repositoryNodeId = `${context.workItem.id}:repository-detected`;
    const architectureNodeId = `${context.workItem.id}:architecture-detected`;
    const boundaryNodeId = `${context.workItem.id}:module-boundary-detected`;

    const provenance: Provenance = {
      sourceType: 'provider',
      sourceId: 'ArchitectureAgent',
      createdAt: new Date().toISOString(),
      runId: context.runId,
      external: false,
    };

    const repositoryDetected: EvidenceNode = Object.freeze({
      id: repositoryNodeId,
      kind: 'signal',
      label: 'RepositoryDetected',
      value: { workItemId: context.workItem.id, capability: 'ArchitectureAgent' },
      confidence: { score: 0.99, source: 'derived' as const, rationale: 'Present in work item.' },
      provenance: Object.freeze([provenance]),
    });

    const architectureDetected: EvidenceNode = Object.freeze({
      id: architectureNodeId,
      kind: 'signal',
      label: 'ArchitectureDetected',
      value: { architecture: result.architecture, deterministic: false },
      confidence: { score: 0.98, source: 'derived' as const, rationale: result.rationale },
      provenance: Object.freeze([provenance]),
    });

    const moduleBoundaryDetected: EvidenceNode = Object.freeze({
      id: boundaryNodeId,
      kind: 'signal',
      label: 'ModuleBoundaryDetected',
      value: { boundaries: result.boundaries },
      confidence: { score: 0.97, source: 'derived' as const, rationale: 'Derived from LLM output' },
      provenance: Object.freeze([provenance]),
    });

    return {
      confidence: 0.98,
      generatedEvidenceLabels: ['RepositoryDetected', 'ArchitectureDetected', 'ModuleBoundaryDetected'],
      nodes: Object.freeze([repositoryDetected, architectureDetected, moduleBoundaryDetected]),
    };
  },
};
