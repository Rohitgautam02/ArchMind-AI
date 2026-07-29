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

describe('PlannerRuntime', () => {
  it('creates execution plan', () => {
    const { planner } = createPlanner();
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
    const { planner, evidenceGraph } = createPlanner();

    evidenceGraph.apply({
      nodes: [{
        id: 'node-1',
        kind: 'package',
        label: 'react',
        value: 'react',
        confidence: { score: 0.9, source: 'tool' },
        provenance: [{ sourceType: 'metadata', sourceId: 'source-1', createdAt: '2026-07-28T00:00:00.000Z', runId: 'run-1', external: false }],
      }],
      provenance: { sourceType: 'metadata', sourceId: 'update-1', createdAt: '2026-07-28T00:00:00.000Z', runId: 'run-1', external: false },
    });

    const result = planner.plan({ metadata: createMetadata('run-1') });

    expect(result.evidenceNodeCount).toBe(1);
    expect(result.executionPlan.workItems[0]?.metadata).toMatchObject({ graphNodeCount: 1 });
  });

  it('no duplicate work items', () => {
    const { planner } = createPlanner();

    const result = planner.plan({ metadata: createMetadata('run-1') });

    expect(result.executionPlan.workItems).toHaveLength(1);
    expect(new Set(result.executionPlan.workItems.map((item) => item.id)).size).toBe(1);
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