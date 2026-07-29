import type { RuntimeMetadata } from '../contracts.js';
import type { EventBus } from '../events/event-bus.js';
import type { RuntimeEvent } from '../events/runtime-event.js';
import type { EvidenceGraph } from '../graph/evidence-graph.js';
import type { ReviewerInput } from './reviewer-input.js';
import type { ReviewerResult } from './reviewer-result.js';
import { ReviewDecision } from './review-decision.js';

export interface ReviewerRuntimeDependencies {
  readonly evidenceGraph: EvidenceGraph;
  readonly eventBus: EventBus;
  readonly minimumConfidence?: number;
}

/**
 * Deterministic reviewer that validates structured agent output against evidence and emits review lifecycle events.
 */
export class ReviewerRuntime {
  readonly #evidenceGraph: EvidenceGraph;
  readonly #eventBus: EventBus;
  readonly #minimumConfidence: number;

  constructor(dependencies: ReviewerRuntimeDependencies) {
    this.#evidenceGraph = dependencies.evidenceGraph;
    this.#eventBus = dependencies.eventBus;
    this.#minimumConfidence = dependencies.minimumConfidence ?? 0.9;
  }

  /** Validate the reviewer input before producing a decision. */
  validate(result: ReviewerInput): void {
    if (!result.runId || !result.workItemId || !result.capability) {
      throw new Error('Missing reviewer metadata');
    }

    if (result.generatedEvidenceIds.length === 0) {
      throw new Error('No evidence produced');
    }

    if (result.findings.length === 0) {
      throw new Error('Empty findings');
    }

    if (new Set(result.generatedEvidenceIds).size !== result.generatedEvidenceIds.length) {
      throw new Error('Duplicate evidence');
    }

    if (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) {
      throw new Error('Invalid confidence');
    }
  }

  /** Review a structured agent result and return a deterministic decision. */
  review(result: ReviewerInput): ReviewerResult {
    this.validate(result);

    const metadata = this.#metadata(result.runId);
    this.#publish('ReviewerRequested', metadata, {
      reviewer: 'DeterministicReviewer',
    });

    const decision = this.#decide(result);
    const reviewedAt = metadata.timestamp;

    if (decision === ReviewDecision.APPROVED) {
      this.#publish('ReviewerApproved', metadata, {
        reviewer: 'DeterministicReviewer',
      });
    } else if (decision === ReviewDecision.REJECTED) {
      this.#publish('ReviewerRejected', metadata, {
        reviewer: 'DeterministicReviewer',
        reason: 'Validation failed or evidence was insufficient.',
      });
    } else {
      this.#publish('ReviewerReanalysisRequested', metadata, {
        reviewer: 'DeterministicReviewer',
        reason: 'Reanalysis required due to confidence or evidence conflict.',
      });
    }

    return Object.freeze({
      runId: result.runId,
      workItemId: result.workItemId,
      decision,
      confidence: result.confidence,
      reasons: Object.freeze(this.#reasonsFor(result, decision)),
      evidenceIds: Object.freeze([...result.generatedEvidenceIds]),
      reviewedAt,
    });
  }

  #decide(result: ReviewerInput): ReviewDecision {
    const hasConflicts = this.#evidenceGraph.listConflicts().length > 0;

    if (hasConflicts || result.confidence < this.#minimumConfidence) {
      return ReviewDecision.REANALYSIS_REQUIRED;
    }

    // Graph-Aware Validation for ArchitectureAgent
    if (result.capability === 'ArchitectureAgent') {
      const generatedNodes = result.generatedEvidenceIds
        .map(id => this.#evidenceGraph.getNode(id))
        .filter(n => n !== undefined);

      const architectureNode = generatedNodes.find(n => n?.label === 'ArchitectureDetected');
      if (architectureNode && architectureNode.value) {
        const arch = (architectureNode.value as any).architecture?.toLowerCase();
        
        // Example Graph-Aware Check:
        // If it claims MVC but there are no backend framework controllers, reject.
        if (arch === 'mvc' || arch === 'layered') {
          const hasControllers = this.#evidenceGraph.findByKind('architecture:pattern').some(n => n.label === 'Layered Architecture');
          const hasExpress = this.#evidenceGraph.findByKind('framework:backend').some(n => n.label === 'Express');
          if (!hasControllers && !hasExpress) {
            return ReviewDecision.REJECTED;
          }
        }
      }
    }

    return ReviewDecision.APPROVED;
  }

  #reasonsFor(result: ReviewerInput, decision: ReviewDecision): readonly string[] {
    if (decision === ReviewDecision.APPROVED) {
      return ['Evidence present', 'Confidence valid', 'No conflicting evidence detected'];
    }

    if (result.confidence < this.#minimumConfidence) {
      return ['Confidence below threshold'];
    }

    if (this.#evidenceGraph.listConflicts().length > 0) {
      return ['Conflicting evidence detected'];
    }

    return ['Validation rejected the structured result'];
  }

  #publish<TType extends 'ReviewerRequested' | 'ReviewerApproved' | 'ReviewerRejected' | 'ReviewerReanalysisRequested'>(
    type: TType,
    metadata: RuntimeMetadata,
    payload: Record<string, unknown>,
  ): void {
    this.#eventBus.publish({
      type,
      metadata,
      payload,
      emittedAt: metadata.timestamp,
    } as unknown as any);
  }

  #metadata(runId: string): RuntimeMetadata {
    return {
      runId,
      workspaceId: 'reviewer',
      timestamp: '2026-07-28T00:00:00.000Z',
      version: '1.0.0',
    };
  }
}