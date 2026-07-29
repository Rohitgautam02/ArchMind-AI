import { describe, expect, it } from 'vitest';
import { AgentRegistry } from './agent-registry.js';
import type { AgentDefinition, AgentOutput } from '../agents/agent-runtime.js';
import { z } from 'zod';

describe('AgentRegistry', () => {
  it('registers and resolves agent definitions', () => {
    const registry = new AgentRegistry();
    const mockAgent: AgentDefinition<unknown> = {
      outputSchema: z.object({}),
      requiredEvidence: [],
      producedEvidence: [],
      buildSystemPrompt: () => '',
      buildUserPrompt: () => '',
      mapToEvidence: () => ({ confidence: 1, generatedEvidenceLabels: [], nodes: [] } as AgentOutput),
    };

    registry.register('mock-agent', mockAgent);
    const resolved = registry.resolve('mock-agent');

    expect(resolved).toBe(mockAgent);
  });

  it('throws on duplicate registration', () => {
    const registry = new AgentRegistry();
    const mockAgent: AgentDefinition<unknown> = {
      outputSchema: z.object({}),
      requiredEvidence: [],
      producedEvidence: [],
      buildSystemPrompt: () => '',
      buildUserPrompt: () => '',
      mapToEvidence: () => ({ confidence: 1, generatedEvidenceLabels: [], nodes: [] } as AgentOutput),
    };

    registry.register('mock-agent', mockAgent);

    expect(() => registry.register('mock-agent', mockAgent)).toThrow(/already registered/);
  });

  it('throws on unknown resolution', () => {
    const registry = new AgentRegistry();

    expect(() => registry.resolve('unknown-agent')).toThrow(/not found/);
  });
});
