import type { RuntimeMetadata } from '../contracts.js';
import type { RuntimeEvent } from '../events/runtime-event.js';
import type { EventBus } from '../events/event-bus.js';
import type { EvidenceGraph } from '../graph/evidence-graph.js';
import type { CapabilityRegistry } from '../registry/capability-registry.js';
import type { ExecutionPlan } from './execution-plan.js';
import type { PlannerResult, PlannerRunContext } from './planner-result.js';
import type { WorkItem } from './work-item.js';

import { defaultPlannerRules } from './planner-rules.js';
import { CapabilityResolver } from './capability-resolver.js';
import { ExecutionScheduler } from './execution-scheduler.js';

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
  
  readonly #resolver: CapabilityResolver;
  readonly #scheduler: ExecutionScheduler;

  constructor(dependencies: PlannerRuntimeDependencies) {
    this.#evidenceGraph = dependencies.evidenceGraph;
    this.#capabilityRegistry = dependencies.capabilityRegistry;
    this.#eventBus = dependencies.eventBus;

    this.#resolver = new CapabilityResolver(this.#capabilityRegistry);
    this.#scheduler = new ExecutionScheduler();
  }

  /**
   * Inspect the current graph and registered capabilities, then produce a deterministic execution plan.
   */
  plan(runContext: PlannerRunContext): PlannerResult {
    const runId = runContext.metadata.runId;
    const graphSnapshot = this.#evidenceGraph.snapshot(runId);
    
    this.#publishPlannerStarted(runContext.metadata);

    const workItems: WorkItem[] = [];

    // Evaluate rules (Policy)
    for (const rule of defaultPlannerRules) {
      const hasProduced = rule.producedEvidenceKinds.every(kind => 
        this.#evidenceGraph.findByKind(kind).length > 0
      );
      if (hasProduced) continue;

      const requiredCounts = rule.requiredEvidenceKinds.map(k => this.#evidenceGraph.findByKind(k).length);
      const missingEvidence = rule.requiredEvidenceKinds.filter(kind => 
        this.#evidenceGraph.findByKind(kind).length === 0
      );

      // Helpful debug info when running tests locally
      // eslint-disable-next-line no-console
      console.debug(`Planner: rule=${rule.targetCapability} requiredCounts=${JSON.stringify(requiredCounts)} missing=${JSON.stringify(missingEvidence)}`);

      // Resolve implementation (Resolution) and schedule if an implementation exists
      const implementation = this.#resolver.resolve(rule.targetCapability);

      if (implementation) {
        const workItem = this.#scheduler.schedule(
          rule.targetCapability,
          implementation,
          graphSnapshot
        );
        workItems.push(workItem);
      } else {
        // eslint-disable-next-line no-console
        console.debug(`Planner: Capability ${rule.targetCapability} required but no implementation resolved.`);
      }
    }

    const executionPlan = this.#freezePlan({
      runId,
      workItems,
      createdAt: runContext.metadata.timestamp,
    });

    this.#publishPlanCreated(runContext.metadata, executionPlan);

    return Object.freeze({
      runId,
      executionPlan,
      inspectedCapabilities: Object.freeze([...this.#capabilityRegistry.listCapabilities()]),
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