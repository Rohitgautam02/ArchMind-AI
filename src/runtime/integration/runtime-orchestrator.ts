import type { EventBus } from '../events/event-bus.js';
import type { RuntimeMetadata } from '../contracts.js';
import type { EvidenceGraph } from '../graph/evidence-graph.js';
import type { ExecutionQueue } from '../execution/execution-queue.js';
import type { PlannerRuntime } from '../planner/planner-runtime.js';
import type { RunManager } from '../run-manager/run-manager.js';
import type { ReviewerRuntime } from '../reviewer/reviewer-runtime.js';
import type { PlannerResult } from '../planner/planner-result.js';
import type { ExecutionPlan } from '../planner/execution-plan.js';
import type { QueueItem } from '../execution/queue-item.js';
import type { ReviewerResult } from '../reviewer/reviewer-result.js';
import type { RunRecord } from '../run-manager/run-record.js';
import type { AgentRuntime, AgentExecutionResult, AgentDefinition } from '../agents/agent-runtime.js';
import type { CapabilityRegistry } from '../registry/capability-registry.js';
import type { AgentRegistry } from '../registry/agent-registry.js';

export interface RuntimePipelineResult {
  readonly runId: string;
  readonly runRecord: RunRecord;
  readonly plannerResult: PlannerResult;
  readonly executionPlan: ExecutionPlan;
  readonly processedItems: readonly QueueItem[];
  readonly agentResults: readonly AgentExecutionResult[];
  readonly reviewerResults: readonly ReviewerResult[];
}

export interface RuntimeOrchestratorDependencies {
  readonly runManager: RunManager;
  readonly plannerRuntime: PlannerRuntime;
  readonly executionQueue: ExecutionQueue;
  readonly agentRuntime: AgentRuntime;
  readonly capabilityRegistry: CapabilityRegistry;
  readonly agentRegistry: AgentRegistry;
  readonly reviewerRuntime: ReviewerRuntime;
  readonly evidenceGraph: EvidenceGraph;
  readonly eventBus: EventBus;
}

/**
 * Deterministic runtime orchestrator that executes the approved runtime slices end to end.
 */
export class RuntimeOrchestrator {
  readonly #runManager: RunManager;
  readonly #plannerRuntime: PlannerRuntime;
  readonly #executionQueue: ExecutionQueue;
  readonly #agentRuntime: AgentRuntime;
  readonly #capabilityRegistry: CapabilityRegistry;
  readonly #agentRegistry: AgentRegistry;
  readonly #reviewerRuntime: ReviewerRuntime;
  readonly #evidenceGraph: EvidenceGraph;
  readonly #eventBus: EventBus;

  constructor(dependencies: RuntimeOrchestratorDependencies) {
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
  async execute(): Promise<RuntimePipelineResult> {
    const { runId } = this.#runManager.createRun();
    this.#runManager.resumeRun(runId);

    const plannerResult = this.#plannerRuntime.plan({
      metadata: this.#metadata(runId),
    });

    const executionPlan = plannerResult.executionPlan;
    this.#executionQueue.enqueue(executionPlan);

    const processedItems: QueueItem[] = [];
    const agentResults: AgentExecutionResult[] = [];
    const reviewerResults: ReviewerResult[] = [];

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

      if (executionResult.status === 'failure') {
        throw new Error(`Agent execution failed: ${executionResult.error}`);
      }

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

  #metadata(runId: string): RuntimeMetadata {
    return {
      runId,
      workspaceId: 'integration',
      timestamp: '2026-07-28T00:00:00.000Z',
      version: '1.0.0',
    };
  }
}