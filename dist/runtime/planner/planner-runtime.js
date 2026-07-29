/**
 * Deterministic planner that converts the current runtime state into a single execution plan.
 */
export class PlannerRuntime {
    #evidenceGraph;
    #capabilityRegistry;
    #eventBus;
    constructor(dependencies) {
        this.#evidenceGraph = dependencies.evidenceGraph;
        this.#capabilityRegistry = dependencies.capabilityRegistry;
        this.#eventBus = dependencies.eventBus;
    }
    /**
     * Inspect the current graph and registered capabilities, then produce a deterministic execution plan.
     */
    plan(runContext) {
        const runId = runContext.metadata.runId;
        const graphSnapshot = this.#evidenceGraph.snapshot(runId);
        const capabilityNames = this.#capabilityRegistry.listCapabilities();
        const architectureAgentAvailable = this.#capabilityRegistry.has('ArchitectureAgent');
        const architectureCandidates = architectureAgentAvailable ? this.#capabilityRegistry.resolveAll('ArchitectureAgent') : [];
        const selectedImplementation = architectureCandidates[0];
        this.#publishPlannerStarted(runContext.metadata);
        const workItem = Object.freeze({
            id: 'work-item-architecture-agent',
            capability: 'ArchitectureAgent',
            priority: 'Normal',
            dependencies: Object.freeze([]),
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
