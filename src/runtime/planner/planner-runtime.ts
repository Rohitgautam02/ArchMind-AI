import type { RuntimeMetadata } from '../contracts.js';
import type { EventBus } from '../events/event-bus.js';
import type { RuntimeEvent } from '../events/runtime-event.js';
import type { EvidenceGraph } from '../graph/evidence-graph.js';
import type { CapabilityRegistry } from '../registry/capability-registry.js';
import type { ExecutionPlan } from './execution-plan.js';
import type { PlannerResult, PlannerRunContext } from './planner-result.js';
import type { WorkItem } from './work-item.js';

export interface PlannerRuntimeDependencies {
  readonly evidenceGraph: EvidenceGraph;
  readonly capabilityRegistry: CapabilityRegistry;
  readonly eventBus: EventBus;
}

/**
 * Deterministic planner that converts the current runtime state into a single execution plan.
 */
export class PlannerRuntime {
  readonly #evidenceGraph: EvidenceGraph;
  readonly #capabilityRegistry: CapabilityRegistry;
  readonly #eventBus: EventBus;

  constructor(dependencies: PlannerRuntimeDependencies) {
    this.#evidenceGraph = dependencies.evidenceGraph;
    this.#capabilityRegistry = dependencies.capabilityRegistry;
    this.#eventBus = dependencies.eventBus;
  }

  /**
   * Inspect the current graph and registered capabilities, then produce a deterministic execution plan.
   */
  plan(runContext: PlannerRunContext): PlannerResult {
    const runId = runContext.metadata.runId;
    const graphSnapshot = this.#evidenceGraph.snapshot(runId);
    const capabilityNames = this.#capabilityRegistry.listCapabilities();
    const architectureAgentAvailable = this.#capabilityRegistry.has('ArchitectureAgent');
    const architectureCandidates = architectureAgentAvailable ? this.#capabilityRegistry.resolveAll('ArchitectureAgent') : [];
    const selectedImplementation = architectureCandidates[0];

    this.#publishPlannerStarted(runContext.metadata);

    const workItem: WorkItem = Object.freeze({
      id: 'work-item-architecture-agent',
      capability: 'ArchitectureAgent',
      priority: 'Normal',
      dependencies: Object.freeze([] as string[]),
      metadata: Object.freeze({
        graphNodeCount: graphSnapshot.nodes.length,
        graphEdgeCount: graphSnapshot.edges.length,
        capabilityAvailable: architectureAgentAvailable,
        availableCapabilities: Object.freeze([...capabilityNames]),
        selectedImplementationId: selectedImplementation?.id,
      }),
    });

    const executionPlan = this.#freezePlan({
      runId,
      workItems: [workItem],
      createdAt: runContext.metadata.timestamp,
    });

    this.#publishPlanCreated(runContext.metadata, executionPlan);

    return Object.freeze({
      runId,
      executionPlan,
      inspectedCapabilities: Object.freeze([...capabilityNames]),
      evidenceNodeCount: graphSnapshot.nodes.length,
      evidenceEdgeCount: graphSnapshot.edges.length,
      createdAt: runContext.metadata.timestamp,
    });
  }

  #publishPlannerStarted(metadata: RuntimeMetadata): void {
    const event: RuntimeEvent<'PlannerStarted'> = {
      type: 'PlannerStarted',
      metadata,
      payload: {
        runId: metadata.runId,
        metadata,
      },
      emittedAt: metadata.timestamp,
    };

    this.#eventBus.publish(event);
  }

  #publishPlanCreated(metadata: RuntimeMetadata, executionPlan: ExecutionPlan): void {
    const event: RuntimeEvent<'PlanCreated'> = {
      type: 'PlanCreated',
      metadata,
      payload: {
        runId: metadata.runId,
        executionPlan,
        metadata,
      },
      emittedAt: metadata.timestamp,
    };

    this.#eventBus.publish(event);
  }

  #freezePlan(plan: ExecutionPlan): ExecutionPlan {
    return Object.freeze({
      runId: plan.runId,
      workItems: Object.freeze([...plan.workItems]),
      createdAt: plan.createdAt,
    });
  }
}