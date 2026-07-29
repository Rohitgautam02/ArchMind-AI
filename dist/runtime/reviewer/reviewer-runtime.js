import { ReviewDecision } from './review-decision.js';
/**
 * Deterministic reviewer that validates structured agent output against evidence and emits review lifecycle events.
 */
export class ReviewerRuntime {
    #evidenceGraph;
    #eventBus;
    #minimumConfidence;
    constructor(dependencies) {
        this.#evidenceGraph = dependencies.evidenceGraph;
        this.#eventBus = dependencies.eventBus;
        this.#minimumConfidence = dependencies.minimumConfidence ?? 0.9;
    }
    /** Validate the reviewer input before producing a decision. */
    validate(result) {
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
    review(result) {
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
        }
        else if (decision === ReviewDecision.REJECTED) {
            this.#publish('ReviewerRejected', metadata, {
                reviewer: 'DeterministicReviewer',
                reason: 'Validation failed or evidence was insufficient.',
            });
        }
        else {
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
    #decide(result) {
        const hasConflicts = this.#evidenceGraph.listConflicts().length > 0;
        if (hasConflicts || result.confidence < this.#minimumConfidence) {
            return ReviewDecision.REANALYSIS_REQUIRED;
        }
        return ReviewDecision.APPROVED;
    }
    #reasonsFor(result, decision) {
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
    #publish(type, metadata, payload) {
        this.#eventBus.publish({
            type,
            metadata,
            payload,
            emittedAt: metadata.timestamp,
        });
    }
    #metadata(runId) {
        return {
            runId,
            workspaceId: 'reviewer',
            timestamp: '2026-07-28T00:00:00.000Z',
            version: '1.0.0',
        };
    }
}
