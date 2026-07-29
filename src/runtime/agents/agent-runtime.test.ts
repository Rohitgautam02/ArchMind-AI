import { describe, expect, it } from 'vitest';
import { AgentRuntime, type AgentDefinition } from './agent-runtime.js';
import { z } from 'zod';
import { EvidenceGraph } from '../graph/evidence-graph.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import { ProviderRegistry } from '../../providers/provider-registry.js';
import type { ProviderAdapter, ProviderHealth, ProviderRequest, ProviderResponse } from '../../providers/provider-contract.js';

class MockProvider implements ProviderAdapter {
  constructor(public readonly name: string) {}
  readonly defaultModel = 'mock';
  readonly supportedModels = ['mock'];
  
  async checkHealth(): Promise<ProviderHealth> {
    return { isHealthy: true, details: 'ok' };
  }
  
  async invoke<T>(request: ProviderRequest): Promise<ProviderResponse<T>> {
    return {
      result: { answer: 'from-llm' } as unknown as T,
      rawText: '...',
      modelUsed: 'mock',
      providerName: 'mock',
      metrics: { durationMs: 1 },
    };
  }
}

describe('AgentRuntime', () => {
  it('executes agent lifecycle using provider', async () => {
    const evidenceGraph = new EvidenceGraph();
    const toolRegistry = new ToolRegistry();
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(new MockProvider('mock'));

    const runtime = new AgentRuntime({ evidenceGraph, toolRegistry, providerRegistry });

    const agentDef: AgentDefinition<{ answer: string }> = {
      outputSchema: z.object({ answer: z.string() }),
      requiredEvidence: [],
      producedEvidence: ['test-node'],
      buildSystemPrompt: () => 'system',
      buildUserPrompt: () => 'user',
      mapToEvidence: (result) => ({
        confidence: 0.9,
        generatedEvidenceLabels: [result.answer],
        nodes: [{
          id: 'node-1',
          kind: 'test',
          label: result.answer,
          confidence: { score: 0.9, source: 'derived' },
          provenance: [],
        }],
      }),
    };

    const result = await runtime.execute({
      runId: 'run-1',
      workItem: { id: 'work-1', capability: 'Test', status: 'PENDING', dependencies: [] },
      agentDefinition: agentDef,
      agentId: 'test-agent',
      agentVersion: '1.0.0',
    });

    expect(result.status).toBe('success');
    expect(result.evidenceIds).toEqual(['node-1']);
    expect(result.generatedEvidenceLabels).toEqual(['from-llm']);

    const nodes = evidenceGraph.listNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.label).toBe('from-llm');
    expect(nodes[0]?.provenance[0]?.sourceId).toBe('test-agent');
  });

  it('bypasses provider if deterministic evidence is sufficient', async () => {
    const evidenceGraph = new EvidenceGraph();
    const toolRegistry = new ToolRegistry();
    const providerRegistry = new ProviderRegistry();

    const runtime = new AgentRuntime({ evidenceGraph, toolRegistry, providerRegistry });

    const agentDef: AgentDefinition<unknown> = {
      outputSchema: z.object({}),
      requiredEvidence: [],
      producedEvidence: ['test-node'],
      isDeterministicEvidenceSufficient: () => true, // Bypass!
      buildSystemPrompt: () => 'system',
      buildUserPrompt: () => 'user',
      mapToEvidence: () => ({
        confidence: 1,
        generatedEvidenceLabels: ['deterministic'],
        nodes: [{
          id: 'node-1',
          kind: 'test',
          label: 'deterministic',
          confidence: { score: 1, source: 'tool' },
          provenance: [],
        }],
      }),
    };

    const result = await runtime.execute({
      runId: 'run-1',
      workItem: { id: 'work-1', capability: 'Test', status: 'PENDING', dependencies: [] },
      agentDefinition: agentDef,
      agentId: 'test-agent',
      agentVersion: '1.0.0',
    });

    expect(result.status).toBe('success');
    expect(result.generatedEvidenceLabels).toEqual(['deterministic']);
  });

  it('returns failure status on error', async () => {
    const evidenceGraph = new EvidenceGraph();
    const toolRegistry = new ToolRegistry();
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(new MockProvider('mock'));

    const runtime = new AgentRuntime({ evidenceGraph, toolRegistry, providerRegistry });

    const agentDef: AgentDefinition<unknown> = {
      outputSchema: z.object({}),
      requiredEvidence: [],
      producedEvidence: [],
      buildSystemPrompt: () => { throw new Error('Failed building prompt'); },
      buildUserPrompt: () => 'user',
      mapToEvidence: () => ({ confidence: 0, generatedEvidenceLabels: [], nodes: [] }),
    };

    const result = await runtime.execute({
      runId: 'run-1',
      workItem: { id: 'work-1', capability: 'Test', status: 'PENDING', dependencies: [] },
      agentDefinition: agentDef,
      agentId: 'test-agent',
      agentVersion: '1.0.0',
    });

    expect(result.status).toBe('failure');
    expect(result.error).toContain('Failed building prompt');
  });
});
