import { describe, expect, it } from 'vitest';
import { EventBus } from '../events/event-bus.js';
import type { RuntimeMetadata } from '../contracts.js';
import { EvidenceGraph } from '../graph/evidence-graph.js';
import { CapabilityRegistry } from '../registry/capability-registry.js';
import { ComponentRegistry } from '../registry/component-registry.js';
import { PlannerRuntime } from './planner-runtime.js';
import type { PlannerRunContext } from './planner-result.js';

const createMetadata = (runId: string): RuntimeMetadata => ({
  runId,
  workspaceId: 'workspace-1',
  timestamp: '2026-07-28T00:00:00.000Z',
  version: '1.0.0',
});

const createPlanner = () => {
  const evidenceGraph = new EvidenceGraph();
  const componentRegistry = new ComponentRegistry();
  componentRegistry.register({
    id: 'architecture-agent-1',
    capability: 'ArchitectureAgent',
    version: '1.0.0',
    priority: 10,
    implementation: () => undefined,
    metadata: { name: 'ArchitectureAgent' },
  });

  const capabilityRegistry = new CapabilityRegistry({ componentRegistry });
  const eventBus = new EventBus();

  return { planner: new PlannerRuntime({ evidenceGraph, capabilityRegistry, eventBus }), eventBus, evidenceGraph };
};

const seedArchitectureRequiredEvidence = (evidenceGraph: EvidenceGraph, runId: string) => {
  const provenance = {
    sourceType: 'metadata' as const,
    sourceId: 'test-fixture',
    createdAt: '2026-07-28T00:00:00.000Z',
    runId,
    external: false,
  };

  evidenceGraph.apply({
    nodes: [
      {
        id: `${runId}:repository`,
        kind: 'metadata:repository',
        label: 'repo',
        confidence: { score: 1, source: 'tool' as const },
        provenance: [provenance],
      },
      {
        id: `${runId}:package-json`,
        kind: 'metadata:package-json',
        label: 'package.json',
        confidence: { score: 1, source: 'tool' as const },
        provenance: [provenance],
      },
      {
        id: `${runId}:framework:frontend`,
        kind: 'framework:frontend',
        label: 'React',
        confidence: { score: 1, source: 'tool' as const },
        provenance: [provenance],
      },
      {
        id: `${runId}:framework:backend`,
        kind: 'framework:backend',
        label: 'Express',
        confidence: { score: 1, source: 'tool' as const },
        provenance: [provenance],
      },
      {
        id: `${runId}:class:App`,
        kind: 'ast:class',
        label: 'App',
        confidence: { score: 1, source: 'tool' as const },
        provenance: [provenance],
      },
    ],
    provenance,
  });
};

describe('PlannerRuntime', () => {
  it('creates execution plan', () => {
    const runId = 'run-1';
    const { planner, evidenceGraph } = createPlanner();
    seedArchitectureRequiredEvidence(evidenceGraph, runId);
    const result = planner.plan({ metadata: createMetadata('run-1') });

    expect(result.executionPlan.runId).toBe('run-1');
    expect(result.executionPlan.workItems).toHaveLength(1);
    expect(result.executionPlan.workItems[0]?.capability).toBe('ArchitectureAgent');
  });

  it('produces deterministic output', () => {
    const { planner } = createPlanner();
    const context: PlannerRunContext = { metadata: createMetadata('run-1') };

    const first = planner.plan(context);
    const second = planner.plan(context);

    expect(first.executionPlan).toEqual(second.executionPlan);
    expect(first.inspectedCapabilities).toEqual(second.inspectedCapabilities);
  });

  it('publishes planner events', () => {
    const { planner, eventBus } = createPlanner();

    planner.plan({ metadata: createMetadata('run-1') });

    expect(eventBus.history().map((event) => event.type)).toEqual(['PlannerStarted', 'PlanCreated']);
  });

  it('handles empty graph', () => {
    const { planner } = createPlanner();

    const result = planner.plan({ metadata: createMetadata('run-1') });

    expect(result.evidenceNodeCount).toBe(0);
    expect(result.evidenceEdgeCount).toBe(0);
  });

  it('handles populated graph', () => {
    const runId = 'run-1';
    const { planner, evidenceGraph } = createPlanner();
    seedArchitectureRequiredEvidence(evidenceGraph, runId);

    const result = planner.plan({ metadata: createMetadata('run-1') });

    expect(result.evidenceNodeCount).toBe(5);
    expect(result.executionPlan.workItems[0]?.metadata).toMatchObject({ graphNodeCount: 5 });
  });

  it('no duplicate work items', () => {
    const runId = 'run-1';
    const { planner, evidenceGraph } = createPlanner();
    seedArchitectureRequiredEvidence(evidenceGraph, runId);
    evidenceGraph.apply({
      nodes: [
        {
          id: `${runId}:architecture-detected`,
          kind: 'ArchitectureDetected',
          label: 'ArchitectureDetected',
          confidence: { score: 0.98, source: 'derived' as const },
          provenance: [{ sourceType: 'provider', sourceId: 'test-fixture', createdAt: '2026-07-28T00:00:00.000Z', runId, external: false }],
        },
        {
          id: `${runId}:module-boundary-detected`,
          kind: 'ModuleBoundaryDetected',
          label: 'ModuleBoundaryDetected',
          confidence: { score: 0.97, source: 'derived' as const },
          provenance: [{ sourceType: 'provider', sourceId: 'test-fixture', createdAt: '2026-07-28T00:00:00.000Z', runId, external: false }],
        },
      ],
      provenance: { sourceType: 'provider', sourceId: 'test-fixture', createdAt: '2026-07-28T00:00:00.000Z', runId, external: false },
    });

    const result = planner.plan({ metadata: createMetadata('run-1') });

    expect(result.executionPlan.workItems).toHaveLength(0);
  });

  it('stable ordering', () => {
    const { planner } = createPlanner();

    const first = planner.plan({ metadata: createMetadata('run-1') });
    const second = planner.plan({ metadata: createMetadata('run-1') });

    expect(first.executionPlan.workItems.map((item) => item.id)).toEqual(second.executionPlan.workItems.map((item) => item.id));
  });

  it('immutable execution plan', () => {
    const { planner } = createPlanner();

    const result = planner.plan({ metadata: createMetadata('run-1') });

    expect(Object.isFrozen(result.executionPlan)).toBe(true);
    expect(Object.isFrozen(result.executionPlan.workItems)).toBe(true);
  });
});