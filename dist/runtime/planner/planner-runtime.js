import { defaultPlannerRules } from './planner-rules.js';
import { CapabilityResolver } from './capability-resolver.js';
import { ExecutionScheduler } from './execution-scheduler.js';
/**
 * Deterministic planner that converts the current runtime state into a single execution plan.
 */
export class PlannerRuntime {
    #evidenceGraph;
    #capabilityRegistry;
    #eventBus;
    #resolver;
    #scheduler;
    constructor(dependencies) {
        this.#evidenceGraph = dependencies.evidenceGraph;
        this.#capabilityRegistry = dependencies.capabilityRegistry;
        this.#eventBus = dependencies.eventBus;
        this.#resolver = new CapabilityResolver(this.#capabilityRegistry);
        this.#scheduler = new ExecutionScheduler();
    }
    /**
     * Inspect the current graph and registered capabilities, then produce a deterministic execution plan.
     */
    plan(runContext) {
        const runId = runContext.metadata.runId;
        const graphSnapshot = this.#evidenceGraph.snapshot(runId);
        this.#publishPlannerStarted(runContext.metadata);
        const workItems = [];
        // Evaluate rules (Policy)
        for (const rule of defaultPlannerRules) {
            const hasProduced = rule.producedEvidenceKinds.every(kind => this.#evidenceGraph.findByKind(kind).length > 0);
            if (hasProduced)
                continue;
            const missingEvidence = rule.requiredEvidenceKinds.filter(kind => this.#evidenceGraph.findByKind(kind).length === 0);
            if (missingEvidence.length === 0) {
                // Resolve implementation (Resolution)
                const implementation = this.#resolver.resolve(rule.targetCapability);
                if (implementation) {
                    // Schedule work (Mechanism)
                    const workItem = this.#scheduler.schedule(rule.targetCapability, implementation, graphSnapshot);
                    workItems.push(workItem);
                }
                else {
                    console.log(`Planner: Capability ${rule.targetCapability} required but no implementation resolved.`);
                }
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
    #publishPlannerStarted(metadata) {
        const event = {
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
    #publishPlanCreated(metadata, executionPlan) {
        const event = {
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
    #freezePlan(plan) {
        return Object.freeze({
            runId: plan.runId,
            workItems: Object.freeze([...plan.workItems]),
            createdAt: plan.createdAt,
        });
    }
}
