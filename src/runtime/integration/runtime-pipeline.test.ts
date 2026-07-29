import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchitectureAgentRuntime } from '../agents/architecture-agent-runtime.js';
import { EventBus } from '../events/event-bus.js';
import { EvidenceGraph } from '../graph/evidence-graph.js';
import { ExecutionQueue } from '../execution/execution-queue.js';
import { PlannerRuntime } from '../planner/planner-runtime.js';
import { CapabilityRegistry } from '../registry/capability-registry.js';
import { ComponentRegistry } from '../registry/component-registry.js';
import { RunManager } from '../run-manager/run-manager.js';
import { ReviewerRuntime } from '../reviewer/reviewer-runtime.js';
import { ReviewDecision } from '../reviewer/review-decision.js';
import { RuntimeOrchestrator } from './runtime-orchestrator.js';

describe('Runtime pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('full runtime execution', async () => {
    const { runtime } = createRuntime();
    const result = await runtime.execute();

    expect(result.runRecord.status).toBe('COMPLETED');
    expect(result.reviewerResults[0]?.decision).toBe(ReviewDecision.APPROVED);
  });

  it('planner invoked', async () => {
    const { runtime } = createRuntime();

    const result = await runtime.execute();

    expect(result.plannerResult.executionPlan.workItems).toHaveLength(1);
  });

  it('queue receives work', async () => {
    const { runtime } = createRuntime();

    const result = await runtime.execute();

    expect(result.processedItems).toHaveLength(1);
    expect(result.executionPlan.workItems).toHaveLength(1);
  });

  it('architecture agent executed', async () => {
    const { runtime } = createRuntime();

    const result = await runtime.execute();

    expect(result.agentResults[0]?.agentId).toBe('architecture-agent-1');
    expect(result.agentResults[0]?.evidenceIds.length).toBe(3);
  });

  it('evidence stored', async () => {
    const { runtime, evidenceGraph } = createRuntime();

    await runtime.execute();

    expect(evidenceGraph.listNodes()).toHaveLength(3);
  });

  it('reviewer approves', async () => {
    const { runtime } = createRuntime();

    const result = await runtime.execute();

    expect(result.reviewerResults[0]?.decision).toBe(ReviewDecision.APPROVED);
  });

  it('reviewer rejects invalid evidence', () => {
    const reviewer = new ReviewerRuntime({ evidenceGraph: new EvidenceGraph(), eventBus: new EventBus() });

    expect(() => reviewer.validate({
      runId: 'run-1',
      workItemId: 'work-1',
      capability: 'ArchitectureAgent',
      confidence: 0.9,
      generatedEvidenceIds: [],
      findings: ['x'],
      evidenceGraph: new EvidenceGraph().snapshot('run-1'),
    })).toThrow('No evidence produced');
  });

  it('reviewer requests reanalysis', () => {
    const reviewer = new ReviewerRuntime({ evidenceGraph: new EvidenceGraph(), eventBus: new EventBus(), minimumConfidence: 0.99 });

    const result = reviewer.review({
      runId: 'run-1',
      workItemId: 'work-1',
      capability: 'ArchitectureAgent',
      confidence: 0.9,
      generatedEvidenceIds: ['node-1'],
      findings: ['Repository detected'],
      evidenceGraph: new EvidenceGraph().snapshot('run-1'),
    });

    expect(result.decision).toBe(ReviewDecision.REANALYSIS_REQUIRED);
  });

  it('RunCompleted emitted', async () => {
    const { runtime, eventBus } = createRuntime();

    await runtime.execute();

    expect(eventBus.history().map((event) => event.type)).toContain('RunCompleted');
  });

  it('deterministic execution', async () => {
    const first = await createRuntime().runtime.execute();
    const second = await createRuntime().runtime.execute();

    expect(first.executionPlan).toEqual(second.executionPlan);
    expect(first.agentResults).toEqual(second.agentResults);
    expect(first.reviewerResults[0]?.decision).toBe(second.reviewerResults[0]?.decision);
  });
});

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
      result: {
        architecture: 'modular-runtime',
        boundaries: ['runtime', 'execution', 'planning', 'graph'],
        rationale: 'Mock rationale',
      } as unknown as T,
      rawText: '...',
      modelUsed: 'mock',
      providerName: 'mock',
      metrics: { durationMs: 1 },
    };
  }
}

import { AgentRegistry } from '../registry/agent-registry.js';
import { AgentRuntime } from '../agents/agent-runtime.js';
import { architectureAgentDefinition } from '../agents/architecture-agent-definition.js';
import { CapabilityRegistry } from '../registry/capability-registry.js';

function createRuntime() {
  const eventBus = new EventBus();
  const evidenceGraph = new EvidenceGraph();
  const componentRegistry = new ComponentRegistry();
  const toolRegistry = new ToolRegistry();
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(new MockProvider('mock'));

  const agentRegistry = new AgentRegistry();
  agentRegistry.register('architecture-agent-1', architectureAgentDefinition);

  componentRegistry.register({
    id: 'architecture-agent-1',
    capability: 'ArchitectureAgent',
    version: '1.0.0',
    priority: 10,
    implementation: 'ignored', // Implementation logic is fetched from agentRegistry
    metadata: { name: 'ArchitectureAgent' },
  });

  const capabilityRegistry = new CapabilityRegistry({ componentRegistry });

  const runManager = new RunManager({ eventBus, evidenceGraph });
  const plannerRuntime = new PlannerRuntime({ evidenceGraph, capabilityRegistry, eventBus });
  const executionQueue = new ExecutionQueue({ eventBus });
  const agentRuntime = new AgentRuntime({ evidenceGraph, toolRegistry, providerRegistry });
  const reviewerRuntime = new ReviewerRuntime({ evidenceGraph, eventBus });

  return {
    runtime: new RuntimeOrchestrator({
      runManager,
      plannerRuntime,
      executionQueue,
      agentRuntime,
      capabilityRegistry,
      agentRegistry,
      reviewerRuntime,
      evidenceGraph,
      eventBus,
    }),
    eventBus,
    evidenceGraph,
  };
}