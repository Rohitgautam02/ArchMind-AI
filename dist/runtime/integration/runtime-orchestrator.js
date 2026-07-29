/**
 * Deterministic runtime orchestrator that executes the approved runtime slices end to end.
 */
export class RuntimeOrchestrator {
    #runManager;
    #plannerRuntime;
    #executionQueue;
    #agentRuntime;
    #capabilityRegistry;
    #agentRegistry;
    #reviewerRuntime;
    #evidenceGraph;
    #eventBus;
    constructor(dependencies) {
        this.#runManager = dependencies.runManager;
        this.#plannerRuntime = dependencies.plannerRuntime;
        this.#executionQueue = dependencies.executionQueue;
        this.#agentRuntime = dependencies.agentRuntime;
        this.#capabilityRegistry = dependencies.capabilityRegistry;
        this.#agentRegistry = dependencies.agentRegistry;
        this.#reviewerRuntime = dependencies.reviewerRuntime;
        this.#evidenceGraph = dependencies.evidenceGraph;
        this.#eventBus = dependencies.eventBus;
    }
    /** Execute a single deterministic runtime pass from planning through review. */
    async execute() {
        const { runId } = this.#runManager.createRun();
        this.#runManager.resumeRun(runId);
        const plannerResult = this.#plannerRuntime.plan({
            metadata: this.#metadata(runId),
        });
        const executionPlan = plannerResult.executionPlan;
        this.#executionQueue.enqueue(executionPlan);
        const processedItems = [];
        const agentResults = [];
        const reviewerResults = [];
        while (this.#executionQueue.hasPending()) {
            const queueItem = this.#executionQueue.dequeue();
            if (!queueItem) {
                break;
            }
            processedItems.push(queueItem);
            const component = await this.#capabilityRegistry.request(queueItem.capability);
            if (!component) {
                throw new Error(`Capability '${queueItem.capability}' could not be resolved to a component.`);
            }
            const agentDefinition = this.#agentRegistry.resolve(component.id);
            const executionResult = await this.#agentRuntime.execute({
                runId,
                workItem: queueItem,
                agentDefinition,
                agentId: component.id,
                agentVersion: component.version,
            });
            agentResults.push(executionResult);
            const reviewerResult = this.#reviewerRuntime.review({
                runId,
                workItemId: queueItem.id,
                capability: queueItem.capability,
                confidence: executionResult.confidence ?? 0,
                generatedEvidenceIds: executionResult.evidenceIds,
                findings: executionResult.generatedEvidenceLabels ?? [],
                evidenceGraph: this.#evidenceGraph.snapshot(runId),
            });
            reviewerResults.push(reviewerResult);
        }
        const runRecord = this.#runManager.completeRun(runId);
        return Object.freeze({
            runId,
            runRecord,
            plannerResult,
            executionPlan,
            processedItems: Object.freeze([...processedItems]),
            agentResults: Object.freeze([...agentResults]),
            reviewerResults: Object.freeze([...reviewerResults]),
        });
    }
    #metadata(runId) {
        return {
            runId,
            workspaceId: 'integration',
            timestamp: '2026-07-28T00:00:00.000Z',
            version: '1.0.0',
        };
    }
}
